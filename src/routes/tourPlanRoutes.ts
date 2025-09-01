import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware.js'
import { createTourPlanController } from '@/controllers/tourPlan/createTourPlanController.js';
import { getTourPlansController } from '@/controllers/tourPlan/getTourPlanController.js';


const router = express.Router();
router.use(tenantMiddleware);

router.post('/createTourPlan', createTourPlanController)
router.get('/getTourPlans', getTourPlansController)

export default router;