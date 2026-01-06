import express, { RequestHandler } from 'express';
import {
    createHighlight,
    getAllHighlights,
    getSingleHighlight,
    updateHighlight,
    deleteHighlight,
    bulkDeleteHighlights,
} from '../controller/HomepageHighlight';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { conditionalLocalUpload } from '../Utils/LocalUpload';

const router = express.Router();

// Public routes
router.get('/v1/highlights', getAllHighlights);
router.get('/v1/highlight/:id', getSingleHighlight as RequestHandler);

// Admin only routes
router.post(
    '/v1/create_highlight',
    authenticate as RequestHandler,
    requireAdmin as RequestHandler,
    conditionalLocalUpload,
    createHighlight as RequestHandler
);
router.patch(
    '/v1/update_highlight/:id',
    authenticate as RequestHandler,
    requireAdmin as RequestHandler,
    conditionalLocalUpload,
    updateHighlight as RequestHandler
);
router.delete(
    '/v1/delete_highlight/:id',
    authenticate as RequestHandler,
    requireAdmin as RequestHandler,
    deleteHighlight as RequestHandler
);

router.delete(
    '/v1/delete_highlights',
    authenticate as RequestHandler,
    requireAdmin as RequestHandler,
    bulkDeleteHighlights as RequestHandler
);

export default router;
