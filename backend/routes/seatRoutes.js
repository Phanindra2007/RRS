import { Router } from 'express';
import { getSeatAvailability } from '../controllers/seatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // Apply authentication middleware to all seat routes
router.get('/availability', getSeatAvailability);

export default router;
