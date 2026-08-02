import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const classes = [
  { classId: 1, name: 'SL' },
  { classId: 2, name: '3A' }
];

export default function BookingPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [form, setForm] = useState({
    classId: 1,
    berthPreference: 'LB',
    passengerName: auth.user?.name || '',
    age: 30,
    gender: 'M'
  });
  const [error, setError] = useState('');

  const sourceStationId = useMemo(() => (state?.sourceStationCode === 'NDLS' ? 1 : 2), [state]);
  const destinationStationId = useMemo(() => (state?.destinationStationCode === 'BCT' ? 2 : 1), [state]);

  if (!state) return <p className="card">Select a train first.</p>;

  async function submitBooking(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        userId: auth.user?.userId || 1,
        scheduleId: state.scheduleId,
        classId: Number(form.classId),
        sourceStationId,
        destinationStationId,
        journeyDate: state.date,
        berthPreference: form.berthPreference,
        passengerName: form.passengerName,
        age: Number(form.age),
        gender: form.gender
      };
      const { data } = await api.post('/api/bookings', payload);
      navigate('/confirmation', { state: { ...data, className: classes.find((c) => c.classId === Number(form.classId))?.name, trainName: state.trainName } });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Booking failed');
    }
  }

  return (
    <section className="card">
      <h2>Booking Page</h2>
      <p>
        <strong>{state.trainName}</strong> ({state.date})
      </p>
      <form onSubmit={submitBooking} className="form">
        <label>
          Class
          <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            {classes.map((cls) => (
              <option key={cls.classId} value={cls.classId}>
                {cls.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Berth preference
          <select value={form.berthPreference} onChange={(e) => setForm({ ...form, berthPreference: e.target.value })}>
            <option value="LB">Lower Berth (LB)</option>
            <option value="MB">Middle Berth (MB)</option>
            <option value="UB">Upper Berth (UB)</option>
            <option value="SL">Side Lower (SL)</option>
            <option value="SU">Side Upper (SU)</option>
          </select>
        </label>
        <input placeholder="Passenger name" value={form.passengerName} onChange={(e) => setForm({ ...form, passengerName: e.target.value })} />
        <input type="number" placeholder="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        <label>
          Gender
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </label>
        <button type="submit">Confirm Booking</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
