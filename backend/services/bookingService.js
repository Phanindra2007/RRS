import pool from '../config/db.js';
import { generatePNR } from '../utils/pnr.js';

async function ensureSeatAllocations(connection, { scheduleId, classId, trainId }) {
  // Ensure that seat allocations exist for the given schedule and class.
  // If not, create them based on the available seats in the SEAT table for the specified train and class.
  await connection.query(
    `INSERT INTO SEAT_ALLOCATION (schedule_id, seat_id, status)
     SELECT ?, s.seat_id, 'AVAILABLE'
     FROM SEAT s
     WHERE s.train_id = ?
       AND s.class_id = ?
       AND s.is_active = 1
     ON DUPLICATE KEY UPDATE allocation_id = allocation_id`,
    [scheduleId, trainId, classId]
  );
}

// for a schedule_id we are only checking if a seat is available for entire journey, not for each segment.
// This is because we are not storing the seat allocation for each segment in the database. Instead, we are
// storing the seat allocation for the entire journey in the SEAT_ALLOCATION table. This is a simplification
// to avoid complexity of managing seat allocations for each segment, which would require additional tables
// and logic to handle overlapping segments and seat availability.
async function getPreferredSeat(connection, { trainId, classId, scheduleId, berthPreference }) {
  await ensureSeatAllocations(connection, { scheduleId, classId, trainId });

  if (berthPreference) { // Preferenced Birth Allocation
    // Future enhancement: We can implement a more sophisticated seat allocation algorithm that takes into
    // account the current occupancy of the train, the number of passengers with similar preferences, and
    // other factors to optimize seat allocation. Also when a family tries to book tickets together, we can
    // try to allocate seats in the same coach or adjacent coaches if possible.
    // For now, we are simply checking for available seats in the preferred berth type and allocating the
    // first available one.
    const [preferred] = await connection.query(
      `SELECT sa.allocation_id, s.seat_id, s.coach_number, s.seat_number, s.berth_type
       FROM SEAT_ALLOCATION sa
       JOIN SEAT s ON s.seat_id = sa.seat_id
       WHERE sa.schedule_id = ?
         AND sa.status = 'AVAILABLE'
         AND s.train_id = ?
         AND s.class_id = ?
         AND s.berth_type = ?
         AND s.coach_number = 'S1'
         AND s.is_active = 1
       ORDER BY s.seat_number
       LIMIT 1
       FOR UPDATE`,
      [scheduleId, trainId, classId, berthPreference]
    );

    // If a preferred seat is found, mark it as booked and return it.
    // Otherwise, we will fall back to the first available seat in the specified class and train.
    if (preferred.length) {
      await connection.query(
        `UPDATE SEAT_ALLOCATION
         SET status = 'BOOKED'
         WHERE allocation_id = ?`,
        [preferred[0].allocation_id]
      );
      return preferred[0];
    }
  }

  const [fallback] = await connection.query(
    `SELECT sa.allocation_id, s.seat_id, s.coach_number, s.seat_number, s.berth_type
     FROM SEAT_ALLOCATION sa
     JOIN SEAT s ON s.seat_id = sa.seat_id
     WHERE sa.schedule_id = ?
       AND sa.status = 'AVAILABLE'
       AND s.train_id = ?
       AND s.class_id = ?
       AND s.coach_number = 'S1'
       AND s.is_active = 1
     ORDER BY s.seat_number
     LIMIT 1
     FOR UPDATE`,
    [scheduleId, trainId, classId]
  );

  if (fallback.length) {
    await connection.query(
      `UPDATE SEAT_ALLOCATION
       SET status = 'BOOKED'
       WHERE allocation_id = ?`,
      [fallback[0].allocation_id]
    );
    return fallback[0];
  }

  return null;
}

// Asuming booking is only one passenger per booking, as we are not storing multiple passengers for a booking in the database.
// This is a simplification to avoid complexity of managing multiple passengers for a booking.
// Future enhancement: this future can be included, then PASSENGER table will be useful more than right now, as we are only storing one passenger per booking in the database.
export async function createBooking(payload) {
  const {
    userId,
    scheduleId,
    classId,
    sourceStationId,
    destinationStationId,
    berthPreference,
    passengerName,
    age,
    gender
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch schedule details
    const [scheduleRows] = await connection.query(
      `SELECT sch.schedule_id, sch.train_id, sch.run_date, tr.train_name
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

    // Fetch route details to calculate distance and fare
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

    // Dynamic Fair Calculation based on distance and class fare per km, rounded to 2 decimal places
    const distance = routeRows[0].destination_distance - routeRows[0].source_distance;
    const fare = Number((distance * classRows[0].fare_per_km).toFixed(2));

    let pnr = generatePNR(); // PNR = passenger name record (size of 10)
    while (true) {
      const [exists] = await connection.query('SELECT booking_id FROM BOOKING WHERE pnr_number = ? LIMIT 1', [pnr]);
      if (!exists.length) break;
      pnr = generatePNR();
    }

    // Insert booking record just after generating PNR to ensure uniqueness
    const [bookingResult] = await connection.query(
      `INSERT INTO BOOKING
       (pnr_number, user_id, schedule_id, class_id, source_station_id, destination_station_id, booking_status, total_fare)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [pnr, userId, scheduleId, classId, sourceStationId, destinationStationId, fare]
    );

    const bookingId = bookingResult.insertId;
    // Fetch preferred seat based on berth preference and availability
    const seat = await getPreferredSeat(connection, {
      trainId: train.train_id,
      classId,
      scheduleId,
      berthPreference
    });

    let ticketStatus = 'WL';
    let seatId = null;
    let wlPosition = null;

    if (seat) {
      ticketStatus = 'CNF';
      seatId = seat.seat_id;
    }

    // Insert passenger record even if the ticket is on waiting list, as we need to keep track of all passengers for a booking.
    const [passengerResult] = await connection.query(
      `INSERT INTO PASSENGER
       (booking_id, passenger_name, age, gender, berth_preference, ticket_status, seat_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, passengerName, age, gender, berthPreference || null, ticketStatus, seatId]
    );

    const passengerId = passengerResult.insertId;

    if (ticketStatus === 'WL') {
      // COALESCE(MAX(wl_position), 0) + 1 AS next_position ensures that if there are no existing waiting list entries, the next position will be 1.
      const [wlRows] = await connection.query(
        `SELECT COALESCE(MAX(wl.wl_position), 0) + 1 AS next_position
         FROM WAITING_LIST wl
         JOIN PASSENGER p ON p.passenger_id = wl.passenger_id
         JOIN BOOKING b ON b.booking_id = p.booking_id
         WHERE b.schedule_id = ? AND b.class_id = ?
         FOR UPDATE`,
        [scheduleId, classId]
      );
      wlPosition = wlRows[0].next_position;
      await connection.query(
        `INSERT INTO WAITING_LIST (passenger_id, wl_position)
         VALUES (?, ?)`,
        [passengerId, wlPosition]
      );
    }

    // - Insert payment record (assuming payment is successful for simplicity) even if the ticket is on waiting list, as we need to keep track of all payments for a booking.
    // - As there is no payment we are assuming refund will be done to the passengers who are in waiting list but not confirmed after the journey date.
    //    This is a simplification to avoid complexity of managing payment and refund for waiting list passengers, which would require additional tables and logic to handle refunds and cancellations.
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
