import { Router } from 'express';
import { getTrainById, searchTrains } from '../controllers/trainController.js';

const router = Router();
router.get('/search', searchTrains);
router.get('/:id', getTrainById);

export default router;
