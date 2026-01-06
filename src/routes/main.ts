import express from 'express'
import auth from './auth'
import Event from './event'
import BoardMemebers from './boardmember'
import Gallery from './gallery'
import donate from './donate'
import membershipPlan from './membershipPlan'
import sponsorshipPlan from './sponsorshipPlan'
import sponsor from './sponsor'
import payment from './payment'
import HomepageHighlight from './homepageHighlight'
import news from './news'
import dashboard from './dashboard'
import home from './home'
const router = express.Router()
router.use('/auth', auth)
router.use('/event', Event)
router.use('/boardmembers', BoardMemebers)
router.use('/donate', donate)
router.use('/gallery', Gallery)
router.use('/membership-plan', membershipPlan)
router.use('/sponsorship-plan', sponsorshipPlan)
router.use('/sponsor', sponsor)
router.use('/payment', payment)
router.use('/homepage-highlight', HomepageHighlight)
router.use('/news', news)
router.use('/dashboard', dashboard)
router.use('/home', home)
export default router