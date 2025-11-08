import express from 'express';
import {
  getCenterDoctors,
  setDoctorAvailability,
  getDoctorAvailability,
  getMonthRangeAvailability,
  markSundaysAsHolidays,
  bulkSetHolidays,
  bulkSetAvailability,
  createAppointmentSlots,
  getAppointmentSlots,
  getDayAppointments,
  bookSlotForPatient,
  deleteAppointmentSlots,
  cancelBookedSlot,
  setDefaultWorkingHours
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

// Receptionist can cancel booked slots
router.post('/slots/cancel', ensureRole('receptionist', 'centeradmin'), cancelBookedSlot);

// CenterAdmin only routes
router.use(ensureRole('centeradmin'));

// Set doctor availability for a date
router.post('/availability', setDoctorAvailability);

// Get doctor availability
router.get('/availability', getDoctorAvailability);

// Set default working hours for all days in a year
router.post('/default-working-hours', setDefaultWorkingHours);

// Mark all Sundays as holidays for a year
router.post('/mark-sundays', markSundaysAsHolidays);

// Bulk set holidays
router.post('/bulk-holidays', bulkSetHolidays);

// Bulk set availability (for available or unavailable dates)
router.post('/bulk-availability', bulkSetAvailability);

// Create appointment slots (accessible by both centeradmin and receptionist)
// Receptionists can create slots when availability times are set
router.post('/slots/create', ensureRole('centeradmin', 'receptionist'), createAppointmentSlots);

// Delete appointment slots (centeradmin only)
router.delete('/slots', deleteAppointmentSlots);

export default router;

