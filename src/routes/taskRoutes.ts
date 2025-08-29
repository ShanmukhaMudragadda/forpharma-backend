import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware'
import { createTaskController } from '@/controllers/tasks/createtaskController';
import { deleteTaskController } from '@/controllers/tasks/deleteTasksController';
import { getTasksController, getTasksOfPlannerController } from '@/controllers/tasks/getTasksController';

const router = express.Router();


router.use(tenantMiddleware);

router.post('/createTask', createTaskController)
router.post('/deletetask/:type/:task_id', deleteTaskController)
router.get('/getTasks/:date', getTasksController)
router.get('/getTasksOfPlannerId/:plannerId', getTasksOfPlannerController)



export default router;