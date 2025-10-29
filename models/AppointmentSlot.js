import mongoose from 'mongoose';

const appointmentSlotSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String, // Format: "HH:mm" (e.g., "09:00")
    required: true
  },
  endTime: {
    type: String, // Format: "HH:mm" (e.g., "09:30")
    required: true
  },
  duration: {
    type: Number, // Duration in minutes
    default: 30
  },
  isBooked: {
    type: Boolean,
    default: false,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: false,
    default: null
  },
  patientAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientAppointment',
    required: false,
    default: null
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Receptionist who booked it
    required: false
  },
  bookedAt: {
    type: Date,
    required: false
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'completed', 'cancelled', 'no_show'],
    default: 'available',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
appointmentSlotSchema.index({ doctorId: 1, date: 1, startTime: 1 });
appointmentSlotSchema.index({ centerId: 1, date: 1 });
appointmentSlotSchema.index({ date: 1, isBooked: 1 });
appointmentSlotSchema.index({ patientId: 1, date: 1 });
appointmentSlotSchema.index({ status: 1, date: 1 });

const AppointmentSlot = mongoose.model('AppointmentSlot', appointmentSlotSchema);
export default AppointmentSlot;

