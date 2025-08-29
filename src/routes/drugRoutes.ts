import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService';
import { createDrug } from '../controllers/drugs/createDrugController'
import { deleteDrug } from '../controllers/drugs/deleteDrugController'
import { getDrugDetails } from '../controllers/drugs/drugDetailsController'
import { getDrugList } from '../controllers/drugs/getDrugListController'
import { updateDrug } from '../controllers/drugs/updateDrugController'
import tenantMiddleware from '@/middlewares/tenantMiddleware';

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();

router.use(tenantMiddleware);

router.post('/create', createDrug);
router.delete('/delete', deleteDrug);
router.get('/getDrugDetails/:drugId', getDrugDetails);
router.get('/getDrugsList', getDrugList);
router.put('/updateDrug/:drugId', updateDrug);




export default router;






