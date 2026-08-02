import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/api/auth/login', form);
      login(data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  }

  return (
    <section className="card">
      <h2>Login</h2>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit">Login</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        New user? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
