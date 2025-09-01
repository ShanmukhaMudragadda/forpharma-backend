import express from 'express';
import tenantMiddleware from '../middlewares/tenantMiddleware.js';
import { createRcpa, getDrugsForRcpa } from '../controllers/rcpa/createRcpaController.js';
import { getRcpaList } from '../controllers/rcpa/getRcpaListController.js';
import { getRcpaDetails } from '../controllers/rcpa/getRcpaDetailsController.js';
import { updateRcpa } from '../controllers/rcpa/updateRcpaController.js';
import { deleteRcpa } from '../controllers/rcpa/deleteRcpaController.js';

const router = express.Router();

// Apply tenant middleware to all RCPA routes
// This ensures all routes have access to req.user and req.tenantDb
router.use(tenantMiddleware);

// RCPA Routes
router.get('/', getRcpaList);                      // GET /api/rcpa - List all RCPA reports
router.get('/drugs', getDrugsForRcpa);             // GET /api/rcpa/drugs - Get drugs for RCPA creation
router.get('/:rcpaId', getRcpaDetails);            // GET /api/rcpa/:rcpaId - Get single RCPA report details
router.post('/', createRcpa);                      // POST /api/rcpa - Create new RCPA report
router.put('/:rcpaId', updateRcpa);                // PUT /api/rcpa/:rcpaId - Update RCPA report
router.delete('/:rcpaId', deleteRcpa);             // DELETE /api/rcpa/:rcpaId - Delete RCPA report

export default router;