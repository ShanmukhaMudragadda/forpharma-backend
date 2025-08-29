import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware'
import { createTourPlanController } from '@/controllers/tourPlan/createTourPlanController';
import { getTourPlansController } from '@/controllers/tourPlan/getTourPlanController';


const router = express.Router();
router.use(tenantMiddleware);

router.post('/createTourPlan', createTourPlanController)
router.get('/getTourPlans', getTourPlansController)

export default router;