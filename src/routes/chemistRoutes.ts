import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService';
import tenantMiddleware from '../middlewares/tenantMiddleware';
import {
    createChemistController,
    updateChemist,
    deleteChemist,
    getChemistListController,
    getChemistDetails
} from '../controllers/chemists/chemistController'

import {
    // ChemistNote Controllers
    createChemistNote,
    getNotesForChemist,
    getChemistNotesByEmployee,
    updateChemistNote,
    deleteChemistNote
} from '../controllers/chemists/chemistNoteController'

import {
    // ChemistInteraction Controllers
    createChemistInteraction,
    getInteractionsForChemist,
    getChemistInteractionsByEmployee,
    updateChemistInteraction,
    deleteChemistInteraction,
} from '../controllers/chemists/chemistInteractionController'
import {


    // DoctorChemistRelation Controllers
    createDoctorChemistRelation,
    getChemistsForDoctor,
    getDoctorsForChemist,
    deleteDoctorChemistRelation
} from '../controllers/chemists/doctorChemistRelationController'

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();

// Basic Chemist routes
router.get('/', tenantMiddleware, getChemistListController);
router.post('/create', tenantMiddleware, createChemistController);
router.put('/updateChemists/:chemistId', tenantMiddleware, updateChemist);
router.delete('/deleteChemists/:chemistId', tenantMiddleware, deleteChemist);
router.get('/getDetails/:chemistId', tenantMiddleware, getChemistDetails);

// ChemistNote routes
router.post('/createNotes', tenantMiddleware, createChemistNote);
router.get('/:chemistId/notes', tenantMiddleware, getNotesForChemist);
router.get('/employees/:employeeId/notes', tenantMiddleware, getChemistNotesByEmployee);
router.put('/updateNotes/:noteId', tenantMiddleware, updateChemistNote);
router.delete('/deleteNotes/:noteId', tenantMiddleware, deleteChemistNote);

// ChemistInteraction routes
router.post('/interactions', tenantMiddleware, createChemistInteraction);
router.get('/:chemistId/interactions', tenantMiddleware, getInteractionsForChemist);
router.get('/employees/:employeeId/interactions', tenantMiddleware, getChemistInteractionsByEmployee);
router.put('/updateInteractions/:interactionId', tenantMiddleware, updateChemistInteraction);
router.delete('/deleteInteractions/:interactionId', tenantMiddleware, deleteChemistInteraction);

// DoctorChemistRelation routes
router.post('/doctor-relations', tenantMiddleware, createDoctorChemistRelation);
router.get('/doctors/:doctorId/chemists', tenantMiddleware, getChemistsForDoctor);
router.get('/:chemistId/doctors', tenantMiddleware, getDoctorsForChemist);
router.delete('/doctor-relations/:relationId', tenantMiddleware, deleteDoctorChemistRelation);

export default router;

