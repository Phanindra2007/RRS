import pool from '../config/db.js';
import { createBooking } from '../services/bookingService.js';

export async function createBookingController(req, res) {
  try {
    const booking = await createBooking(req.body);
    return res.status(201).json(booking);
  } catch (error) {
    return res.status(400).json({ message: 'Booking failed', error: error.message });
  }
}

export async function getBookingByPNR(req, res) {
  try {
    const { pnr } = req.params;
    // Even if we remove CASE-END it behaves the same way, because we are using LEFT JOIN
    // for SEAT and WAITING_LIST tables. If there is no matching record in these tables,
    // the corresponding columns will be NULL, which is what we want for waiting list passengers.
    const [rows] = await pool.query(
      `SELECT b.booking_id, b.pnr_number, b.total_fare, b.booking_status,
              sch.run_date AS journey_date, sch.departure_time, sch.arrival_time,
              tr.train_name, tr.train_number, c.class_name,
              p.passenger_name, p.age, p.gender, p.ticket_status,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.coach_number
              END AS coach_number,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.seat_number
              END AS seat_number,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.berth_type
              END AS berth_type,
              CASE
                WHEN p.ticket_status = 'WL' THEN wl.wl_position
                ELSE NULL
              END AS wl_position
       FROM BOOKING b
       JOIN SCHEDULE sch ON sch.schedule_id = b.schedule_id
       JOIN TRAIN tr ON tr.train_id = sch.train_id
       JOIN PASSENGER p ON p.booking_id = b.booking_id
       LEFT JOIN SEAT s ON s.seat_id = p.seat_id
       LEFT JOIN CLASS c ON c.class_id = b.class_id
       LEFT JOIN WAITING_LIST wl ON wl.passenger_id = p.passenger_id
       WHERE b.pnr_number = ?`,
      [pnr]
    );

    if (!rows.length) return res.status(404).json({ message: 'PNR not found' });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'PNR fetch failed', error: error.message });
  }
}

export async function getBookingsByUser(req, res) {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query(
      `SELECT b.booking_id, b.pnr_number, sch.run_date AS journey_date, b.total_fare, b.booking_status,
              sch.departure_time, sch.arrival_time,
              tr.train_name, tr.train_number, c.class_name,
              p.passenger_name, p.ticket_status,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.coach_number
              END AS coach_number,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.seat_number
              END AS seat_number,
              CASE
                WHEN p.ticket_status = 'WL' THEN NULL
                ELSE s.berth_type
              END AS berth_type,
              CASE
                WHEN p.ticket_status = 'WL' THEN wl.wl_position
                ELSE NULL
              END AS wl_position
       FROM BOOKING b
       JOIN SCHEDULE sch ON sch.schedule_id = b.schedule_id
       JOIN TRAIN tr ON tr.train_id = sch.train_id
       JOIN PASSENGER p ON p.booking_id = b.booking_id
       LEFT JOIN SEAT s ON s.seat_id = p.seat_id
       LEFT JOIN CLASS c ON c.class_id = b.class_id
       LEFT JOIN WAITING_LIST wl ON wl.passenger_id = p.passenger_id
       WHERE b.user_id = ?
       ORDER BY b.booking_id DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Booking history failed', error: error.message });
  }
}

export async function cancelBooking(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    // lock the booking and passenger rows to prevent race conditions during cancellation and seat reallocation
    const [bookingRows] = await connection.query(
      `SELECT b.booking_id, b.booking_status, b.schedule_id, b.class_id, p.passenger_id, p.seat_id
       FROM BOOKING b
       JOIN PASSENGER p ON p.booking_id = b.booking_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!bookingRows.length) { // If no booking is found, rollback the transaction and return a 404 response
      await connection.rollback();
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = bookingRows[0];
    if (booking.booking_status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    const [paymentRows] = await connection.query(
      'SELECT amount FROM PAYMENT WHERE booking_id = ? ORDER BY payment_id DESC LIMIT 1',
      [id]
    );

    const amount = paymentRows.length ? Number(paymentRows[0].amount) : 0;
    const cancellationCharge = Number((amount * 0.1).toFixed(2));
    const refundAmount = Number((amount - cancellationCharge).toFixed(2));

    // If its a confirm ticket:
    // update booking status to cancelled
    await connection.query('UPDATE BOOKING SET booking_status = ? WHERE booking_id = ?', ['CANCELLED', id]);
    // free up the seat_id in the PASSENGER table to indicate that the passenger no longer has an assigned seat
    await connection.query('UPDATE PASSENGER SET seat_id = NULL WHERE passenger_id = ?', [booking.passenger_id]);

    // If its a waiting list:
    // remove the passenger from the waiting list if they were on it
    await connection.query('DELETE FROM WAITING_LIST WHERE passenger_id = ?', [booking.passenger_id]);
    
    // free up the seat if it was assigned, and update the seat allocation status to AVAILABLE
    // and add a record in the CANCELLATION table to log the cancellation details, including the freed seat_id
    if (booking.seat_id) {
      await connection.query(
        `UPDATE SEAT_ALLOCATION
         SET status = 'AVAILABLE'
         WHERE schedule_id = ?
           AND seat_id = ?
           AND status = 'BOOKED'`,
        [booking.schedule_id, booking.seat_id]
      );

      await connection.query(
        `INSERT INTO CANCELLATION
        (booking_id, cancelled_at, cancellation_charge, refund_amount, freed_seat_id)
        VALUES (?, NOW(), ?, ?, ?)`,
        [id, cancellationCharge, refundAmount, booking.seat_id]
      );
    }

    await connection.commit();
    return res.json({ message: 'Booking cancelled successfully', refundAmount, cancellationCharge });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Cancellation failed', error: error.message });
  } finally {
    connection.release();
  }
}
