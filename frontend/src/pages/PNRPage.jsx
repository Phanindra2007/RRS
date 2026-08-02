import { useState } from 'react';
import api from '../services/api';

function berthText(berthType) {
  return (
    {
      LB: 'Lower Berth',
      MB: 'Middle Berth',
      UB: 'Upper Berth',
      SL: 'Side Lower',
      SU: 'Side Upper'
    }[berthType] || berthType
  );
}

export default function PNRPage() {
  const [pnr, setPnr] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function check(e) {
    e.preventDefault();
    setError('');
    setData(null);
    try {
      const res = await api.get(`/api/bookings/${pnr}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'PNR lookup failed');
    }
  }

  return (
    <section className="card">
      <h2>PNR Status</h2>
      <form className="form inline" onSubmit={check}>
        <input placeholder="Enter PNR" value={pnr} onChange={(e) => setPnr(e.target.value.toUpperCase())} />
        <button type="submit">Check Status</button>
      </form>
      {error && <p className="error">{error}</p>}
      {data && (
        <div>
          <p>Train: {data.train_name}</p>
          <p>Status: {data.ticket_status}</p>
          {data.ticket_status === 'CNF' ? (
            <p className="highlight">
              Coach {data.coach_number} - Seat {data.seat_number} ({berthText(data.berth_type)})
            </p>
          ) : (
            <p className="highlight">WL Position: {data.wl_position}</p>
          )}
        </div>
      )}
    </section>
  );
}
