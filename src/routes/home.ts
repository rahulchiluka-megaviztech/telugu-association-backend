import express from 'express';
import { getHomeData } from '../controller/Home';

const router = express.Router();

router.get('/v1/data', getHomeData);

export default router;
