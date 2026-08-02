import pool from '../config/db.js';
import { generatePNR } from '../utils/pnr.js';

async function getPreferredSeat(connection, { trainId, classId, scheduleId, journeyDate, berthPreference }) {

  // Get already booked seat IDs for this specific schedule
  const [bookedSeats] = await connection.query(
    `SELECT p.seat_id
     FROM PASSENGER p
     JOIN BOOKING b ON b.booking_id = p.booking_id
     WHERE b.schedule_id = ?
       AND b.class_id = ?
       AND b.journey_date = ?
       AND b.booking_status = 'ACTIVE'
       AND p.ticket_status = 'CNF'
       AND p.seat_id IS NOT NULL`,
    [scheduleId, classId, journeyDate]
  );

  const bookedSeatIds = bookedSeats.map(r => r.seat_id);
  const excludeClause = bookedSeatIds.length
    ? `AND s.seat_id NOT IN (${bookedSeatIds.join(',')})`
    : '';

  // Try preferred berth in coach S1 only
  if (berthPreference) {
    const [preferred] = await connection.query(
      `SELECT s.seat_id, s.coach_number, s.seat_number, s.berth_type
       FROM SEAT s
       WHERE s.train_id = ?
         AND s.class_id = ?
         AND s.berth_type = ?
         AND s.coach_number = 'S1'
         AND s.is_active = 1
         ${excludeClause}
       ORDER BY s.seat_number
       LIMIT 1
       FOR UPDATE`,
      [trainId, classId, berthPreference]
    );
    if (preferred.length) return preferred[0];
  }

  // Fallback — any available seat in S1 only
  const [fallback] = await connection.query(
    `SELECT s.seat_id, s.coach_number, s.seat_number, s.berth_type
     FROM SEAT s
     WHERE s.train_id = ?
       AND s.class_id = ?
       AND s.coach_number = 'S1'
       AND s.is_active = 1
       ${excludeClause}
     ORDER BY s.seat_number
     LIMIT 1
     FOR UPDATE`,
    [trainId, classId]
  );

  return fallback[0] || null;
}

export async function createBooking(payload) {
  const {
    userId,
    scheduleId,
    classId,
    sourceStationId,
    destinationStationId,
    journeyDate,
    berthPreference,
    passengerName,
    age,
    gender
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [scheduleRows] = await connection.query(
      `SELECT sch.schedule_id, sch.train_id, tr.train_name
       FROM SCHEDULE sch
       JOIN TRAIN tr ON tr.train_id = sch.train_id
       WHERE sch.schedule_id = ?
       LIMIT 1`,
      [scheduleId]
    );

    if (!scheduleRows.length) {
      throw new Error('Schedule not found');
    }

    const train = scheduleRows[0];

    const [classRows] = await connection.query('SELECT class_id, class_name, fare_per_km FROM CLASS WHERE class_id = ? LIMIT 1', [classId]);
    if (!classRows.length) throw new Error('Class not found');

    const [routeRows] = await connection.query(
      `SELECT r1.distance_from_source AS source_distance, r2.distance_from_source AS destination_distance
       FROM ROUTE r1
       JOIN ROUTE r2 ON r1.train_id = r2.train_id
       WHERE r1.train_id = ? AND r1.station_id = ? AND r2.station_id = ?
       LIMIT 1`,
      [train.train_id, sourceStationId, destinationStationId]
    );

    if (!routeRows.length || routeRows[0].destination_distance <= routeRows[0].source_distance) {
      throw new Error('Invalid source/destination for selected train');
    }

    const distance = routeRows[0].destination_distance - routeRows[0].source_distance;
    const fare = Number((distance * classRows[0].fare_per_km).toFixed(2));

    let pnr = generatePNR();
    while (true) {
      const [exists] = await connection.query('SELECT booking_id FROM BOOKING WHERE pnr_number = ? LIMIT 1', [pnr]);
      if (!exists.length) break;
      pnr = generatePNR();
    }

    const [bookingResult] = await connection.query(
      `INSERT INTO BOOKING
       (pnr_number, user_id, schedule_id, class_id, source_station_id, destination_station_id, journey_date, booking_status, total_fare)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [pnr, userId, scheduleId, classId, sourceStationId, destinationStationId, journeyDate, fare]
    );

    const bookingId = bookingResult.insertId;
    const seat = await getPreferredSeat(connection, {
      trainId: train.train_id,
      classId,
      scheduleId,
      journeyDate,
      berthPreference
    });

    let ticketStatus = 'WL';
    let seatId = null;
    let wlPosition = null;

    if (seat) {
      ticketStatus = 'CNF';
      seatId = seat.seat_id;
    }

    const [passengerResult] = await connection.query(
      `INSERT INTO PASSENGER
       (booking_id, passenger_name, age, gender, berth_preference, ticket_status, seat_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, passengerName, age, gender, berthPreference || null, ticketStatus, seatId]
    );

    const passengerId = passengerResult.insertId;

    if (ticketStatus === 'WL') {
      const [wlRows] = await connection.query(
        `SELECT COALESCE(MAX(wl_position), 0) + 1 AS next_position
         FROM WAITING_LIST
         WHERE schedule_id = ? AND class_id = ? AND journey_date = ?
         FOR UPDATE`,
        [scheduleId, classId, journeyDate]
      );
      wlPosition = wlRows[0].next_position;
      await connection.query(
        `INSERT INTO WAITING_LIST (passenger_id, schedule_id, class_id, journey_date, wl_position)
         VALUES (?, ?, ?, ?, ?)`,
        [passengerId, scheduleId, classId, journeyDate, wlPosition]
      );
    }

    await connection.query(
      `INSERT INTO PAYMENT (booking_id, amount, payment_method, payment_status)
       VALUES (?, ?, 'UPI', 'SUCCESS')`,
      [bookingId, fare]
    );

    await connection.commit();

    return {
      bookingId,
      pnr,
      trainName: train.train_name,
      classId,
      ticketStatus,
      wlPosition,
      fare,
      seat: seat
        ? {
            coachNumber: seat.coach_number,
            seatNumber: seat.seat_number,
            berthType: seat.berth_type
          }
        : null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
