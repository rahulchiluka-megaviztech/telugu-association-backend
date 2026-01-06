import express, { RequestHandler } from 'express';
import {
  createSponsor,
  getAllSponsors,
  getActiveSponsors,
  getSponsorById,
  updateSponsor,
  toggleSponsorStatus,
  deleteSponsor,
  deleteAllSponsors,
} from '../controller/Sponsor';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { conditionalLocalUpload } from '../Utils/LocalUpload';

const router = express.Router();

// Public routes - users can view active sponsors
router.get('/v1/active-sponsors', getActiveSponsors);
router.get('/v1/sponsor/:id', getSponsorById);

// Admin only routes
router.post('/v1/create', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, createSponsor as RequestHandler);
router.get('/v1/all', authenticate as RequestHandler, requireAdmin as RequestHandler, getAllSponsors);
router.patch('/v1/update/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, updateSponsor as RequestHandler);
router.patch('/v1/toggle-status/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, toggleSponsorStatus);
router.delete('/v1/delete/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteSponsor);
router.delete('/v1/delete-all', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteAllSponsors);

export default router;
