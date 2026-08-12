import pool from '../config/db.js';

export async function getSeatAvailability(req, res) {
  try {
    const { scheduleId, classId, date } = req.query;
    if (!scheduleId || !classId || !date) {
      return res.status(400).json({ message: 'scheduleId, classId and date are required' });
    }

    const [scheduleRows] = await pool.query('SELECT train_id FROM SCHEDULE WHERE schedule_id = ? LIMIT 1', [scheduleId]);
    if (!scheduleRows.length) return res.status(404).json({ message: 'Schedule not found' });

    const trainId = scheduleRows[0].train_id;

    const [[data]] = await pool.query(
      `SELECT
        COUNT(s.seat_id) AS total_seats,
        SUM(CASE WHEN sa.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_seats,
        COUNT(s.seat_id) - SUM(CASE WHEN sa.status = 'BOOKED' THEN 1 ELSE 0 END) AS available_seats
      FROM SEAT s
      LEFT JOIN SEAT_ALLOCATION sa
        ON sa.seat_id = s.seat_id
      AND sa.schedule_id = ?
      WHERE s.train_id = ?
        AND s.class_id = ?
        AND s.is_active = 1;`
    );

    return res.json({
      totalSeats: data.total_seats,
      confirmedBooked: data.booked_seats,
      availableSeats: data.available_seats
    });
  } catch (error) {
    return res.status(500).json({ message: 'Seat availability check failed', error: error.message });
  }
}
