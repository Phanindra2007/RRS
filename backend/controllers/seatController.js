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

    const [totals] = await pool.query(
      'SELECT COUNT(*) AS total FROM SEAT WHERE train_id = ? AND class_id = ? AND is_active = 1',
      [trainId, classId]
    );

    const [occupied] = await pool.query(
      `SELECT COUNT(*) AS booked
       FROM PASSENGER p
       JOIN BOOKING b ON b.booking_id = p.booking_id
       WHERE b.schedule_id = ?
         AND b.class_id = ?
         AND b.journey_date = ?
         AND b.booking_status = 'ACTIVE'
         AND p.ticket_status = 'CNF'`,
      [scheduleId, classId, date]
    );

    return res.json({
      totalSeats: totals[0].total,
      confirmedBooked: occupied[0].booked,
      availableSeats: totals[0].total - occupied[0].booked
    });
  } catch (error) {
    return res.status(500).json({ message: 'Seat availability check failed', error: error.message });
  }
}
