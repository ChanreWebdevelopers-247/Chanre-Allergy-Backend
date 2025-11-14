import MedicalDocument from '../models/MedicalDocument.js';
import Patient from '../models/Patient.js';
import PatientAppointment from '../models/PatientAppointment.js';
import History from '../models/historyModel.js';

export const buildDownloadPath = (id) => `api/documents/${id}/download`;

const coerceObjectId = (value) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? value : value.toString();
  } catch (_err) {
    return null;
  }
};

/**
 * Persist an array of uploaded files or document descriptors and return the saved documents.
 * Each descriptor can either reference an existing document (documentId) or contain raw file data.
 *
 * @param {Array<object>} documents
 * @param {object} defaults
 * @returns {Promise<Array<MedicalDocument>>}
 */
export const persistDocuments = async (documents = [], defaults = {}) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const savedDocuments = [];

  for (const doc of documents) {
    if (!doc) continue;

    // Already persisted document reference
    if (doc.documentId) {
      const existing = await MedicalDocument.findById(doc.documentId);
      if (existing) {
        savedDocuments.push(existing);
      }
      continue;
    }

    // Raw document stored in memory
    if (doc.buffer || doc.data) {
      const buffer = doc.buffer || doc.data;
      const size = doc.size || buffer?.length || 0;

      const payload = {
        originalName: doc.originalName || doc.originalname || doc.filename || 'medical-document',
        mimeType: doc.mimeType || doc.mimetype || 'application/octet-stream',
        size,
        data: buffer,
        source: doc.source || defaults.source || null,
        context: doc.context || defaults.context || null,
        uploadedBy: doc.uploadedBy || defaults.uploadedBy || null,
        patientId: doc.patientId || defaults.patientId || null,
        appointmentId: doc.appointmentId || defaults.appointmentId || defaults.linkedAppointmentId || null,
        billingId: doc.billingId || defaults.billingId || null,
        historyId: doc.historyId || defaults.historyId || null,
        centerId: doc.centerId || defaults.centerId || null,
      };

      const newDocument = await MedicalDocument.create(payload);
      savedDocuments.push(newDocument);
      continue;
    }

    // Legacy descriptor with only metadata and path; keep metadata without creating duplicate storage
    if (doc.path && doc.filename) {
      // We cannot migrate automatically without file buffer; skip persistence but keep metadata by wrapping
      savedDocuments.push({
        _id: doc.documentId || doc._id || null,
        originalName: doc.originalName || doc.filename,
        mimeType: doc.mimeType || 'application/octet-stream',
        size: doc.size || 0,
        createdAt: doc.uploadedAt || new Date(),
        source: doc.source || defaults.source || null,
        context: doc.context || defaults.context || null,
        uploadedBy: doc.uploadedBy || defaults.uploadedBy || null,
        patientId: doc.patientId || defaults.patientId || null,
        appointmentId: doc.appointmentId || defaults.appointmentId || defaults.linkedAppointmentId || null,
        billingId: doc.billingId || defaults.billingId || null,
        historyId: doc.historyId || defaults.historyId || null,
        centerId: doc.centerId || defaults.centerId || null,
        path: doc.path,
        isLegacy: true,
      });
    }
  }

  return savedDocuments;
};

export const serializeDocument = (document, overrides = {}) => {
  if (!document) return null;

  const id = coerceObjectId(document._id);

  const base = {
    documentId: id,
    originalName: document.originalName,
    mimeType: document.mimeType || 'application/octet-stream',
    size: document.size || 0,
    uploadedAt: document.createdAt || document.uploadedAt || new Date(),
    source: document.source || null,
    context: document.context || null,
    uploadedBy: document.uploadedBy || null,
    patientId: document.patientId || null,
    appointmentId: document.appointmentId || null,
    billingId: document.billingId || null,
    historyId: document.historyId || null,
    centerId: document.centerId || null,
    path: document.path || (id ? buildDownloadPath(id) : null),
  };

  return {
    ...base,
    ...overrides,
  };
};

export const enrichDocumentsForResponse = (documents = [], overrides = {}) =>
  documents
    .map((doc) => serializeDocument(doc, overrides))
    .filter(Boolean);

/**
 * Resolve metadata such as patientId and centerId when not provided.
 *
 * @param {object} defaults
 * @returns {Promise<object>}
 */
export const resolveDocumentContext = async (defaults = {}) => {
  const context = { ...defaults };

  if (!context.centerId && context.patientId) {
    const patient = await Patient.findById(context.patientId).select('centerId');
    if (patient?.centerId) {
      context.centerId = patient.centerId;
    }
  }

  if (!context.centerId && context.appointmentId) {
    const appointment = await PatientAppointment.findById(context.appointmentId).select('centerId');
    if (appointment?.centerId) {
      context.centerId = appointment.centerId;
    }
  }

  // Resolve patientId and centerId from historyId
  if (!context.patientId && context.historyId) {
    const history = await History.findById(context.historyId).select('patientId');
    if (history?.patientId) {
      context.patientId = history.patientId;
      // Also resolve centerId from the patient
      const patient = await Patient.findById(history.patientId).select('centerId');
      if (patient?.centerId) {
        context.centerId = patient.centerId;
      }
    }
  }

  return context;
};

export default {
  persistDocuments,
  serializeDocument,
  enrichDocumentsForResponse,
  resolveDocumentContext,
  buildDownloadPath,
};


