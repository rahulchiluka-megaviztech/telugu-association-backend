import express, { RequestHandler } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import {
  createGallery,
  delete_all_gallery,
  deleteGallery,
  get_Gallery,
  singledeleteImage,
  singleGallery,
  update_Gallery
} from '../controller/Gallery';
import { conditionalLocalUpload } from '../Utils/LocalUpload';

const router = express.Router();

// Public routes
router.get('/v1/all_galleries', get_Gallery);
router.get('/v1/single_gallery/:id', singleGallery);

// Admin only routes
router.post('/v1/create_gallery', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, createGallery as RequestHandler);
router.patch('/v1/update_gallery/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, update_Gallery as RequestHandler);
router.delete('/v1/delete_single_gallery/:id/:cloudfileId', authenticate as RequestHandler, requireAdmin as RequestHandler, singledeleteImage as RequestHandler);
router.delete('/v1/delete_gallery/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteGallery as RequestHandler);
router.delete('/v1/delete_galleries', authenticate as RequestHandler, requireAdmin as RequestHandler, delete_all_gallery as RequestHandler);

export default router;
