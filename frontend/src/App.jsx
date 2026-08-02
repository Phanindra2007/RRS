import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import PNRPage from './pages/PNRPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="/pnr" element={<PNRPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
