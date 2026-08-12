import { Router } from 'express';
import {
  cancelBooking,
  createBookingController,
  getBookingByPNR,
  getBookingsByUser
} from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // Apply authentication middleware to all booking routes
router.post('/', createBookingController);
router.get('/user/:userId', getBookingsByUser);
router.post('/:id/cancel', cancelBooking);
router.get('/:pnr', getBookingByPNR);

export default router;
