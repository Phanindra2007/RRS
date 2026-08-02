import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HistoryPage() {
  const { auth } = useAuth();
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    if (!auth.user?.userId) return;
    const { data } = await api.get(`/api/bookings/user/${auth.user.userId}`);
    setRows(data);
  }

  useEffect(() => {
    load();
  }, [auth.user?.userId]);

  async function handleCancel(bookingId) {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { data } = await api.post(`/api/bookings/${bookingId}/cancel`);
      setMessage(`Cancelled! Refund: ₹${data.refundAmount} (Charge: ₹${data.cancellationCharge})`);
      load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Cancellation failed');
    }
  }

  return (
    <section className="card">
      <h2>Booking History</h2>
      {message && (
        <div style={{ padding: '10px', marginBottom: '10px', background: '#f0fff0', border: '1px solid green', borderRadius: '6px', color: 'green' }}>
          {message}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>PNR</th>
            <th>Train</th>
            <th>Date</th>
            <th>Status</th>
            <th>Seat/WL</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.booking_id}>
              <td>{row.pnr_number}</td>
              <td>{row.train_name}</td>
              <td>{String(row.journey_date).slice(0, 10)}</td>
              <td>{row.ticket_status}</td>
              <td>
                {row.ticket_status === 'CNF'
                  ? `${row.coach_number}-${row.seat_number} (${row.berth_type})`
                  : row.booking_status === 'CANCELLED'
                  ? 'Cancelled'
                  : `WL ${row.wl_position}`}
              </td>
              <td>
                {row.booking_status !== 'CANCELLED' ? (
                  <button
                    onClick={() => handleCancel(row.booking_id)}
                    style={{ background: 'red', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                ) : (
                  <span style={{ color: 'gray' }}>Cancelled</span>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan="6">No bookings found</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}