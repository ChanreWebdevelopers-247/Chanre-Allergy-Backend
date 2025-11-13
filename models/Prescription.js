import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  medicationName: String,
  dosage: String,
  duration: String,
  frequency: String,
  instructions: String
}, { _id: false });

const testSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  instruction: { type: String, trim: true },
  status: { type: String, trim: true },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestRequest' }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center' },
  visit: String,
  date: { type: Date, default: Date.now },
  diagnosis: String,
  medications: [medicationSchema],
  tests: [testSchema],
  instructions: String,
  followUp: String,
  followUpInstruction: String,
  remarks: String,
  preparedBy: String,
  preparedByCredentials: String,
  medicalCouncilNumber: String,
  printedBy: String,
  reportGeneratedAt: Date,
  prescribedBy: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Prescription', prescriptionSchema); 