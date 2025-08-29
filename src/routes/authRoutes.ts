import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService';
import { loginController, createUserController, googleLoginController, activateAccountController, fetchUsersController } from '../controllers/authController'
import { upload } from '../middlewares/multerConfig';

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();


router.post('/create', upload.single('image'), createUserController);
router.post('/login', loginController);
router.post('/google_login', googleLoginController);
router.post('/activate_account', activateAccountController);
router.get('/get_users', fetchUsersController);

export default router;