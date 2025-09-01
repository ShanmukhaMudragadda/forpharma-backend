import express from 'express';
import SchemaManagementService from '../services/SchemaManagementService.js';
import {
    createDoctorController,
    getDoctorListController,
    updateDoctor,
    deleteDoctor,
    getDoctorDetails,
} from '../controllers/doctors/doctorController.js'
import {
    // DoctorHospitalAssociation
    createDoctorHospitalAssociation,
    getDoctorHospitals,
    updateDoctorHospitalAssociation,
    deleteDoctorHospitalAssociation,
    setPrimaryHospital,
} from '../controllers/doctors/doctorHospitalAssociation.js'

import {
    // DoctorConsultationSchedule
    createDoctorConsultationSchedule,
    getDoctorSchedules,
    updateDoctorConsultationSchedule,
    deleteDoctorConsultationSchedule,
    toggleScheduleStatus,
} from '../controllers/doctors/doctorConsultationController.js'

import {
    // DoctorNote
    createDoctorNote,
    getNotesForDoctor,
    getNotesByEmployee,
    updateDoctorNote,
    deleteDoctorNote,
} from '../controllers/doctors/doctorNoteController.js'
import {
    // DoctorInteraction
    createDoctorInteraction,
    getInteractionsForDoctor,
    getInteractionsByEmployee,
    updateDoctorInteraction,
    deleteDoctorInteraction
} from '../controllers/doctors/doctorIntreactionController.js'
import tenantMiddleware from '../middlewares/tenantMiddleware.js';

const router = express.Router();
const schemaService = SchemaManagementService.getInstance();

// Doctor basic routes
router.get('/', tenantMiddleware, getDoctorListController);
router.post('/create', tenantMiddleware, createDoctorController);
router.put('/updateDoctors/:doctorId', tenantMiddleware, updateDoctor);
router.delete('/deleteDoctors/:doctorId', tenantMiddleware, deleteDoctor);
router.get('/getDetails/:doctorId', tenantMiddleware, getDoctorDetails);

// DoctorHospitalAssociation routes
router.post('/createAssociations', tenantMiddleware, createDoctorHospitalAssociation);
router.get('/:doctorId/hospitals', tenantMiddleware, getDoctorHospitals);
router.put('/updateAssociations/:associationId', tenantMiddleware, updateDoctorHospitalAssociation);
router.delete('/deleteAssociations/:associationId', tenantMiddleware, deleteDoctorHospitalAssociation);
router.put('/:doctorId/hospitals/:hospitalId/set-primary', tenantMiddleware, setPrimaryHospital);

// DoctorConsultationSchedule routes
router.post('/createSchedules', tenantMiddleware, createDoctorConsultationSchedule);
router.get('/:doctorId/schedules', tenantMiddleware, getDoctorSchedules);
router.put('/updateSchedules/:scheduleId', tenantMiddleware, updateDoctorConsultationSchedule);
router.delete('/deleteSchedules/:scheduleId', tenantMiddleware, deleteDoctorConsultationSchedule);
router.patch('/schedules/:scheduleId/toggle-status', tenantMiddleware, toggleScheduleStatus);

// DoctorNote routes
router.post('/createNotes', tenantMiddleware, createDoctorNote);
router.get('/:doctorId/notes', tenantMiddleware, getNotesForDoctor);
router.get('/employees/:employeeId/notes', tenantMiddleware, getNotesByEmployee);
router.put('/updateNotes/:noteId', tenantMiddleware, updateDoctorNote);
router.delete('/deleteNotes/:noteId', tenantMiddleware, deleteDoctorNote);

// DoctorInteraction routes
router.post('/createInteractions', tenantMiddleware, createDoctorInteraction);
router.get('/:doctorId/interactions', tenantMiddleware, getInteractionsForDoctor);
router.get('/:employeeId/interactions', tenantMiddleware, getInteractionsByEmployee);
router.put('/updateInteractions/:interactionId', tenantMiddleware, updateDoctorInteraction);
router.delete('/deleteInteractions/:interactionId', tenantMiddleware, deleteDoctorInteraction);

export default router;