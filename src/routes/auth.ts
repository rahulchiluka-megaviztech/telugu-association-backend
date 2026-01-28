import express, { RequestHandler } from 'express'
import { ChangePassword, ForgetPassword, GoogleSignIn, MemberAuth, MemberAuth_Confirm, MemberAuth_Edit, MemberAuth_getData, SignIn, UpdatePassword, VerifyOtp, getAllMembers, deleteMembers, adminAddMember, adminEditMember, volunteerRegistration, adminAddVolunteer, adminEditVolunteer, getAllVolunteers, deleteVolunteers, bulkAddMembers, bulkAddVolunteers, getAdminProfile, verifyEmailChange, getProfile } from '../controller/Auth'
import { validateUser } from '../Utils/validateUser'
import { authenticate, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.middleware'
import { csvUpload } from '../middleware/csvUpload'

const router = express.Router()

// Public routes
router.post('/v1/register', validateUser, MemberAuth)
router.post('/v1/signin', SignIn)
router.post('/v1/google-signin', GoogleSignIn)
router.post('/v1/volunteer/register', volunteerRegistration)
router.patch('/v1/forgetpassword', ForgetPassword)
router.patch('/v1/verifyotp', VerifyOtp)
router.patch('/v1/changepassword', ChangePassword)

// Protected routes - authenticated users only
router.patch('/v1/updatepassword', authenticate as RequestHandler, UpdatePassword)
router.get('/v1/profile', authenticate as RequestHandler, getProfile)
 

// Protected routes - user can edit own profile OR admin can edit any
router.patch('/v1/members_register_edit/:id', authenticate as RequestHandler, requireSelfOrAdmin('id') as RequestHandler, MemberAuth_Edit)
router.get('/v1/members_register_getdata/:id', authenticate as RequestHandler, requireSelfOrAdmin('id') as RequestHandler, MemberAuth_getData)

// Admin only
router.get('/v1/admin/profile', authenticate as RequestHandler, requireAdmin as RequestHandler, getAdminProfile)
router.patch('/v1/verify-email-change', authenticate as RequestHandler, requireAdmin as RequestHandler, verifyEmailChange)
router.patch('/v1/members_register_confirm/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, MemberAuth_Confirm)
router.get('/v1/all-members', getAllMembers)
router.delete('/v1/delete-members', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteMembers)
router.post('/v1/admin/add-member', authenticate as RequestHandler, requireAdmin as RequestHandler, adminAddMember)
router.put('/v1/admin/edit-member/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, adminEditMember)
router.post('/v1/admin/add-volunteer', authenticate as RequestHandler, requireAdmin as RequestHandler, adminAddVolunteer)
router.put('/v1/admin/edit-volunteer/:id', authenticate as RequestHandler, requireAdmin as RequestHandler, adminEditVolunteer)
router.get('/v1/admin/volunteers', authenticate as RequestHandler, requireAdmin as RequestHandler, getAllVolunteers)
router.delete('/v1/admin/delete-volunteers', authenticate as RequestHandler, requireAdmin as RequestHandler, deleteVolunteers)
router.post('/v1/admin/bulk-add-members', authenticate as RequestHandler, requireAdmin as RequestHandler, csvUpload.single('file'), bulkAddMembers)
router.post('/v1/admin/bulk-add-volunteers', authenticate as RequestHandler, requireAdmin as RequestHandler, csvUpload.single('file'), bulkAddVolunteers)

export default router