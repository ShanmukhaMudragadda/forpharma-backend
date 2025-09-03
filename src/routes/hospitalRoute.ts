import express from 'express';
import { createHospital, fetchHospitals } from '../controllers/hospitals/hospitalController.js';
import tenantMiddleware from '@/middlewares/tenantMiddleware.js';
const router = express.Router();


router.post('/create', tenantMiddleware, createHospital);
router.get('/', tenantMiddleware, fetchHospitals);

export default router;
