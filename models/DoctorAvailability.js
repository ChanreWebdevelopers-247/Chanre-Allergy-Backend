import mongoose from 'mongoose';

const doctorAvailabilitySchema = new mongoose.Schema({
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
  isAvailable: {
    type: Boolean,
    default: true
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayName: {
    type: String,
    default: ''
  },
  startTime: {
    type: String, // Format: "HH:mm" (e.g., "09:00")
    required: false
  },
  endTime: {
    type: String, // Format: "HH:mm" (e.g., "17:00")
    required: false
  },
  breakStartTime: {
    type: String,
    required: false
  },
  breakEndTime: {
    type: String,
    required: false
  },
  notes: {
    type: String,
    default: ''
  },
  maxAppointments: {
    type: Number,
    default: 50 // Default max appointments per day
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
doctorAvailabilitySchema.index({ doctorId: 1, date: 1 });
doctorAvailabilitySchema.index({ centerId: 1, date: 1 });
doctorAvailabilitySchema.index({ date: 1, isAvailable: 1 });

const DoctorAvailability = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
export default DoctorAvailability;

