import express from 'express';
import {
  getCenterDoctors,
  setDoctorAvailability,
  getDoctorAvailability,
  getMonthRangeAvailability,
  markSundaysAsHolidays,
  bulkSetHolidays,
  createAppointmentSlots,
  getAppointmentSlots,
  getDayAppointments,
  bookSlotForPatient,
  deleteAppointmentSlots
} from '../controllers/doctorCalendarController.js';
import { protect, ensureRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all doctors for the center (accessible by centeradmin and receptionist)
router.get('/doctors', ensureRole('centeradmin', 'receptionist'), getCenterDoctors);

// Get appointment slots (accessible by receptionist to view available slots)
router.get('/slots', ensureRole('centeradmin', 'receptionist'), getAppointmentSlots);

// Get day appointments (accessible by both)
router.get('/day-appointments', ensureRole('centeradmin', 'receptionist'), getDayAppointments);

// Get month range availability (for calendar view)
router.get('/month-availability', ensureRole('centeradmin', 'receptionist'), getMonthRangeAvailability);

// Receptionist can book slots
router.post('/slots/book', ensureRole('receptionist', 'centeradmin'), bookSlotForPatient);

// CenterAdmin only routes
router.use(ensureRole('centeradmin'));

// Set doctor availability for a date
router.post('/availability', setDoctorAvailability);

// Get doctor availability
router.get('/availability', getDoctorAvailability);

// Mark all Sundays as holidays for a year
router.post('/mark-sundays', markSundaysAsHolidays);

// Bulk set holidays
router.post('/bulk-holidays', bulkSetHolidays);

// Create appointment slots
router.post('/slots/create', createAppointmentSlots);

// Delete appointment slots
router.delete('/slots', deleteAppointmentSlots);

export default router;

