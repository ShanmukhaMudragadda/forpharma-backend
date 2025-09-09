import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware.js'
import { createTaskPlannerController } from '../controllers/taskPlanner/createTaskPlannerControlller.js';
import { deleteTaskPlannerController } from '../controllers/taskPlanner/deleteTaskPlannerController.js';
import { getTaskPlannerController } from '../controllers/taskPlanner/getTaskPlannerController.js';
import { updateTaskPlannerStatusController } from '../controllers/taskPlanner/updateTaskPlannerStatusController.js';

const router = express.Router();


router.use(tenantMiddleware);
router.post('/createTaskPlanner', createTaskPlannerController);
router.delete('/deleteTaskPlanner/:taskPlanner_id', deleteTaskPlannerController)
router.put('/updateTaskPlannerStatus/:taskPlanner_id', updateTaskPlannerStatusController)

router.get('/getTaskPlanner', getTaskPlannerController)

export default router;
