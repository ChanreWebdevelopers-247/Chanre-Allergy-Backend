import mongoose from 'mongoose';

const medicationTestSchema = new mongoose.Schema({
  testName: { type: String, trim: true },
  testCode: { type: String, trim: true },
  instruction: { type: String, trim: true },
  status: {
    type: String,
    trim: true,
    enum: [
      'requested',
      'assigned',
      'sample_collected',
      'in_lab_testing',
      'testing_completed',
      'report_generated',
      'report_sent',
      'completed',
      'cancelled',
      'pending',
      ''
    ],
    default: 'requested'
  },
  requestedAt: { type: Date },
  completedAt: { type: Date },
  resultSummary: { type: String },
  notes: { type: String },
}, { _id: false, timestamps: false });

const medicationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  testRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestRequest' },
  drugName: { type: String, required: true },
  dose: { type: String, required: true },
  duration: { type: String, required: true },
  frequency: { type: String },
  prescribedBy: { type: String },
  prescribedDate: { type: Date },
  instructions: { type: String },
  followUpInstruction: { type: String },
  remarks: { type: String },
  adverseEvent: { type: String },
  tests: [medicationTestSchema],
}, { timestamps: true });

medicationSchema.index({ patientId: 1, prescribedDate: -1 });
medicationSchema.index({ testRequestId: 1 });

const Medication = mongoose.model('Medication', medicationSchema);
export default Medication;