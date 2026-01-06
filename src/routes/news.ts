import express, { RequestHandler } from 'express';
import { getAllNews, getNewsById, updateNews, createNews } from '../controller/News';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/v1/all', getAllNews);
router.get('/v1/:id', getNewsById);
router.post('/v1/create', authenticate as RequestHandler, requireAdmin as RequestHandler, createNews);
router.put('/v1/edit/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, updateNews);

export default router;
