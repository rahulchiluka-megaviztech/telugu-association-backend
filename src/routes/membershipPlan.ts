import express, { RequestHandler } from 'express';
import {
  createMembershipPlan,
  getAllMembershipPlans,
  getActiveMembershipPlans,
  getMembershipPlanById,
  updateMembershipPlan,
  togglePlanStatus,
  deleteMembershipPlan,
  deleteAllMembershipPlans,
} from '../controller/MembershipPlan';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = express.Router();

// Public routes - users can view active plans
router.get('/v1/active-plans', getActiveMembershipPlans);
router.get('/v1/plan/:id', getMembershipPlanById);

// Admin only routes
router.post('/v1/create', authenticate as RequestHandler, requireAdmin as RequestHandler, createMembershipPlan);
router.get('/v1/all', authenticate as RequestHandler, requireAdmin as RequestHandler, getAllMembershipPlans);
router.patch('/v1/update/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, updateMembershipPlan);
router.patch('/v1/toggle-status/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, togglePlanStatus);
router.delete('/v1/delete/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteMembershipPlan);
router.delete('/v1/delete-all', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteAllMembershipPlans);

export default router;
