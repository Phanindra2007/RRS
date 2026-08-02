import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { auth, logout } = useAuth();
  return (
    <div className="container">
      <header className="header">
        <h1>Railway Reservation System</h1>
        <nav>
          <Link to="/">Search</Link>
          <Link to="/pnr">PNR Status</Link>
          {auth.user && <Link to="/history">Booking History</Link>}
          {!auth.user ? <Link to="/login">Login</Link> : <button onClick={logout}>Logout</button>}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
