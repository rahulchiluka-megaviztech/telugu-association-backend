import express from 'express'
import { cancelOrder, captureOrder, createOrder, donates } from '../controller/Donation'
const router = express.Router()
router.post('/v1/create', createOrder);
router.get('/v1/complete-order/:orderId', captureOrder);
router.get('/v1/cancel-order', cancelOrder);
router.get('/v1/all', donates as any);
export default router