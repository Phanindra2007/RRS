import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/api/auth/register', form);
      setMessage(data.message || 'Registered');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  }

  return (
    <section className="card">
      <h2>Register</h2>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button type="submit">Create Account</button>
      </form>
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
      <p>
        Already registered? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
