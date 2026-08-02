import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function SearchPage() {
  const [form, setForm] = useState({ source: 'NDLS', destination: 'BCT', date: '2026-04-20' });
  const [trains, setTrains] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function search(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.get('/api/trains/search', { params: form });
      setTrains(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
    }
  }

  return (
    <div>
      <section className="card">
        <h2>Search Trains</h2>
        <form className="form inline" onSubmit={search}>
          <input placeholder="Source code" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value.toUpperCase() })} />
          <input placeholder="Destination code" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <button type="submit">Search</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h3>Train Results</h3>
        <table>
          <thead>
            <tr>
              <th>Train</th>
              <th>Number</th>
              <th>Route</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trains.map((t) => (
              <tr key={t.schedule_id}>
                <td>{t.train_name}</td>
                <td>{t.train_number}</td>
                <td>
                  {t.source_station} → {t.destination_station}
                </td>
                <td>{t.run_date?.slice(0, 10)}</td>
                <td>
                  <button
                    onClick={() =>
                      navigate('/book', {
                        state: {
                          scheduleId: t.schedule_id,
                          trainId: t.train_id,
                          trainName: t.train_name,
                          sourceStationCode: form.source,
                          destinationStationCode: form.destination,
                          date: form.date
                        }
                      })
                    }
                  >
                    Book
                  </button>
                </td>
              </tr>
            ))}
            {!trains.length && (
              <tr>
                <td colSpan="5">No results</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
