import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService.js';
import { createOrganizationController } from '../controllers/organizationController.js';

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();



console.log('Starting application initialization...');
// IMPORTANT: Load tenant migrations before any requests can come in
// await schemaService.initializeMigrations();

(async () => {
    try {
        await schemaService.initializeMigrations();
        console.log('run initializeMigrations() function in organization Routes');
    } catch (error) {
        console.error('Failed to run initializeMigrations() function in organization Routes')
    }

})();
console.log('✅ Tenant migrations loaded successfully.');

console.log("organization ROutes");


router.post('/create', createOrganizationController)



export default router;






