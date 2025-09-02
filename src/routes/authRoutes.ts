import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService.js';
import { loginController, createUserController, googleLoginController, activateAccountController, fetchUsersController } from '../controllers/authController.js'
import { upload } from '../middlewares/multerConfig.js';
import { Request, Response } from 'express';
import { createUserInShared } from '../controllers/userInSharedDB.js'
const router = express.Router();
const schemaService = SchemaManagementService.getInstance();


router.post('/create', upload.single('image'), createUserController);
router.post('/login', loginController);
router.post('/google_login', googleLoginController);
router.post('/activate_account', activateAccountController);
router.get('/get_users', fetchUsersController);
router.post('/createUserInsharedOnly', createUserInShared);


export default router;