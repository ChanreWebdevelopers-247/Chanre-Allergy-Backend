import mongoose from 'mongoose';

const medicalDocumentSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  source: { type: String, default: null },
  context: { type: String, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientAppointment', default: null },
  billingId: { type: mongoose.Schema.Types.ObjectId, default: null },
  historyId: { type: mongoose.Schema.Types.ObjectId, ref: 'History', default: null },
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', default: null },
}, {
  timestamps: true,
});

medicalDocumentSchema.index({ patientId: 1, createdAt: -1 });
medicalDocumentSchema.index({ appointmentId: 1 });
medicalDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });

const MedicalDocument = mongoose.model('MedicalDocument', medicalDocumentSchema);
export default MedicalDocument;


