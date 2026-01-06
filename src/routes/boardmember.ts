import express, { RequestHandler } from 'express'
import { createBoardMember, deleteBoardMember, getBoardMembers, singleBoardMember, updateBoardMember } from '../controller/BoardMembers'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { conditionalLocalUpload } from '../Utils/LocalUpload'

const router = express.Router()

// Public routes
router.get('/v1/boardmemebers', getBoardMembers)
router.get('/v1/single_boardmemeber/:id', singleBoardMember)

// Admin only routes
router.post('/v1/create_boardmemeber', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, createBoardMember as RequestHandler)
router.patch('/v1/update_boardmemeber/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, conditionalLocalUpload, updateBoardMember as RequestHandler)
router.delete('/v1/delete_boardmemeber/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteBoardMember as RequestHandler)

export default router