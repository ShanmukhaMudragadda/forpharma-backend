import express from 'express';
import tenantMiddleware from '../middlewares/tenantMiddleware';
import { createDcr, getTasksForDcr } from '../controllers/dcr/createDcrController';
import { getDcrList } from '../controllers/dcr/getDcrListController';
import { getDcrDetails } from '../controllers/dcr/getDcrDetailsController';
import { updateDcr } from '../controllers/dcr/updateDcrController';
import { deleteDcr } from '../controllers/dcr/deleteDcrController';

const router = express.Router();

// Apply tenant middleware to all DCR routes
// This ensures all routes have access to req.user and req.tenantDb
router.use(tenantMiddleware);

// DCR Routes
router.get('/', getDcrList);                       // GET /api/dcr - List all DCR reports
router.get('/tasks/available', getTasksForDcr);    // GET /api/dcr/tasks/available - Get tasks for DCR creation
router.get('/:dcrId', getDcrDetails);              // GET /api/dcr/:dcrId - Get single DCR details
router.post('/', createDcr);                       // POST /api/dcr - Create new DCR report
router.put('/:dcrId', updateDcr);                  // PUT /api/dcr/:dcrId - Update existing DCR report
router.delete('/:dcrId', deleteDcr);               // DELETE /api/dcr/:dcrId - Delete DCR report

export default router;