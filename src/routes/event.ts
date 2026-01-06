import express, { RequestHandler } from 'express'
import { singleEvent, createEvents, deleteEvent, getEvents, singledeleteImage, updateEvent, delete_all_Events } from '../controller/Events'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { conditionalLocalUpload } from '../Utils/LocalUpload'

const router = express.Router()

// Public routes
router.get('/v1/events', getEvents)
router.get('/v1/single_event/:id', singleEvent)

// Admin only routes
router.post('/v1/create_event', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, createEvents)
router.patch('/v1/update_event/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, updateEvent)
router.delete('/v1/delete_event/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteEvent)
router.delete('/v1/delete_single_gallery/:id/:cloudfileId', authenticate as RequestHandler, requireAdmin as RequestHandler, singledeleteImage)
router.delete('/v1/delete_all_events', authenticate as RequestHandler, requireAdmin as RequestHandler, delete_all_Events)

export default router