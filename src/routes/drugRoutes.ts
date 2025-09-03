import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService.js';
import { createDrug } from '../controllers/drugs/createDrugController.js'
import { deleteDrug } from '../controllers/drugs/deleteDrugController.js'
import { getDrugDetails } from '../controllers/drugs/drugDetailsController.js'
import { getDrugList } from '../controllers/drugs/getDrugListController.js'
import { updateDrug } from '../controllers/drugs/updateDrugController.js'
import tenantMiddleware from '@/middlewares/tenantMiddleware.js';

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();

router.use(tenantMiddleware);

router.post('/create', createDrug);
router.delete('/delete/":drugId', deleteDrug);
router.get('/getDrugDetails/:drugId', getDrugDetails);
router.get('/getDrugsList', getDrugList);
router.put('/updateDrug/:drugId', updateDrug);




export default router;






