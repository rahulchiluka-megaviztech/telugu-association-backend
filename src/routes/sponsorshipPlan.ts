import express, { RequestHandler } from 'express';
import {
  createSponsorshipPlan,
  getAllSponsorshipPlans,
  getActiveSponsorshipPlans,
  getSponsorshipPlanById,
  updateSponsorshipPlan,
  toggleSponsorshipPlanStatus,
  deleteSponsorshipPlan,
  deleteAllSponsorshipPlans,
} from '../controller/SponsorshipPlan';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = express.Router();

// Public routes - users can view active plans
router.get('/v1/active-plans', getActiveSponsorshipPlans);
router.get('/v1/plan/:id', getSponsorshipPlanById);

// Admin only routes
router.post('/v1/create', authenticate as RequestHandler, requireAdmin as RequestHandler, createSponsorshipPlan);
router.get('/v1/all', authenticate as RequestHandler, requireAdmin as RequestHandler, getAllSponsorshipPlans);
router.patch('/v1/update/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, updateSponsorshipPlan);
router.patch('/v1/toggle-status/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, toggleSponsorshipPlanStatus);
router.delete('/v1/delete/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteSponsorshipPlan);
router.delete('/v1/delete-all', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteAllSponsorshipPlans);

export default router;
