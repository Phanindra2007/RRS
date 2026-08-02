import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import trainRoutes from './routes/trainRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import seatRoutes from './routes/seatRoutes.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/seats', seatRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error' });
});

export default app;
