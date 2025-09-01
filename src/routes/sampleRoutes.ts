import express from 'express';
import tenantMiddleware from '../middlewares/tenantMiddleware.js';
import { getDrugInventory, getGiftInventory } from '../controllers/samples/getInventoryController.js';
import { getCustomers, createDistribution } from '../controllers/samples/createDistributionController.js';
import { getDistributions } from '../controllers/samples/getDistributionsController.js';
import { getDistributionDetails } from '../controllers/samples/getDistributionDetailsController.js';

const router = express.Router();

// Apply tenant middleware to all sample routes
// This ensures all routes have access to req.user and req.tenantDb
router.use(tenantMiddleware);

// Sample Inventory Routes
router.get('/inventory/drugs', getDrugInventory);          // GET /api/samples/inventory/drugs - Get drug inventory only
router.get('/inventory/gifts', getGiftInventory);          // GET /api/samples/inventory/gifts - Get gift inventory only

// Sample Distribution Routes
router.get('/customers', getCustomers);                    // GET /api/samples/customers - Get all customers in territory
router.get('/distributions', getDistributions);            // GET /api/samples/distributions - Get all distributions
router.get('/distributions/:distributionId', getDistributionDetails); // GET /api/samples/distributions/:id - Get distribution details
router.post('/distributions', createDistribution);         // POST /api/samples/distributions - Create new distribution

export default router;