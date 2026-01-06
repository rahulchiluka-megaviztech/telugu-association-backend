import express from 'express';
import { getDashboardData } from '../controller/Dashboard';

const router = express.Router();

router.get('/v1/data', getDashboardData);

export default router;
