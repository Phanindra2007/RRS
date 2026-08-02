import { Router } from 'express';
import { getSeatAvailability } from '../controllers/seatController.js';

const router = Router();
router.get('/availability', getSeatAvailability);

export default router;
