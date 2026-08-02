import pool from '../config/db.js';

export async function searchTrains(req, res) {
  try {
    const { source, destination, date } = req.query;
    if (!source || !destination || !date) {
      return res.status(400).json({ message: 'source, destination, and date are required' });
    }

    const [rows] = await pool.query(
      `SELECT sch.schedule_id, sch.run_date, tr.train_id, tr.train_name, tr.train_number,
              s1.station_name AS source_station, s2.station_name AS destination_station
       FROM SCHEDULE sch
       JOIN TRAIN tr ON tr.train_id = sch.train_id
       JOIN ROUTE r1 ON r1.train_id = tr.train_id
       JOIN ROUTE r2 ON r2.train_id = tr.train_id
       JOIN STATION s1 ON s1.station_id = r1.station_id
       JOIN STATION s2 ON s2.station_id = r2.station_id
       WHERE s1.station_code = ?
         AND s2.station_code = ?
         AND r1.stop_number < r2.stop_number
         AND sch.run_date = ?
       ORDER BY tr.train_number`,
      [source, destination, date]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Train search failed', error: error.message });
  }
}

export async function getTrainById(req, res) {
  try {
    const { id } = req.params;
    const [trainRows] = await pool.query('SELECT * FROM TRAIN WHERE train_id = ? LIMIT 1', [id]);
    if (!trainRows.length) return res.status(404).json({ message: 'Train not found' });

    const [routeRows] = await pool.query(
      `SELECT r.stop_number, r.arrival_time, r.departure_time, r.distance_from_source, st.station_name, st.station_code
       FROM ROUTE r
       JOIN STATION st ON st.station_id = r.station_id
       WHERE r.train_id = ?
       ORDER BY r.stop_number`,
      [id]
    );

    return res.json({ ...trainRows[0], route: routeRows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch train details', error: error.message });
  }
}
