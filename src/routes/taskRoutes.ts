import express from 'express'
import tenantMiddleware from '@/middlewares/tenantMiddleware.js'
import { createTaskController } from '@/controllers/tasks/createtaskController.js';
import { deleteTaskController } from '@/controllers/tasks/deleteTasksController.js';
import { getTasksController, getTasksOfPlannerController } from '@/controllers/tasks/getTasksController.js';

const router = express.Router();


router.use(tenantMiddleware);

router.post('/createTask', createTaskController)
router.post('/deletetask/:type/:task_id', deleteTaskController)
router.get('/getTasks/:date', getTasksController)
router.get('/getTasksOfPlannerId/:plannerId', getTasksOfPlannerController)



export default router;