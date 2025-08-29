import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware'
import { createTaskPlannerController } from '@/controllers/taskPlanner/createTaskPlannerControlller';
import { deleteTaskPlannerController } from '@/controllers/taskPlanner/deleteTaskPlannerController';
import { getTaskPlannerController } from '@/controllers/taskPlanner/gettaskPlannerController';

const router = express.Router();


router.use(tenantMiddleware);

router.post('/createTaskPlanner', createTaskPlannerController);
router.post('/deleteTaskPlanner/:taskPlanner_id', deleteTaskPlannerController)
router.get('/getTaskPlanner', getTaskPlannerController)

export default router;
