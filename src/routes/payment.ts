import express, { RequestHandler } from 'express';
import {
  createOrder,
  captureOrder,
  handleWebhook,
  getPaymentHistory
} from '../controller/Payment';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Public routes
router.post('/v1/create-order', createOrder);
router.post('/v1/capture-order', captureOrder);
router.post('/v1/webhook', handleWebhook); // PayPal webhook endpoint

// Authenticated routes
router.get('/v1/history', authenticate as RequestHandler, getPaymentHistory);

export default router;
