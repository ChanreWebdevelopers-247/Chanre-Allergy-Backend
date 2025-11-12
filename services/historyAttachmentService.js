import History from '../models/historyModel.js';
import {
  persistDocuments,
  enrichDocumentsForResponse,
  resolveDocumentContext,
  buildDownloadPath,
} from './documentService.js';

/**
 * Attach documents to the latest history record for a patient. If no history record exists,
 * a new one will be created with only attachments populated.
 *
 * @param {string|object} patientId Mongoose ObjectId or string
 * @param {Array<object>} documents Array of documents (multer files or stored docs)
 * @param {object} options Additional metadata ({ source, context, uploadedBy, linkedAppointmentId, centerId })
 * @returns {Promise<object|null>} Updated or created history record
 */
export const attachDocumentsToHistory = async (patientId, documents = [], options = {}) => {
  if (!patientId || !Array.isArray(documents) || documents.length === 0) {
    return null;
  }

  const context = await resolveDocumentContext({
    patientId,
    ...options,
  });

  const persistedDocuments = await persistDocuments(documents, context);
  if (persistedDocuments.length === 0) {
    return null;
  }

  const serializedDocs = enrichDocumentsForResponse(persistedDocuments, context);

  if (serializedDocs.length === 0) {
    return null;
  }

  let historyRecord = null;

  if (options.historyId) {
    historyRecord = await History.findById(options.historyId);
  }

  if (!historyRecord) {
    historyRecord = await History.findOne({ patientId }).sort({ createdAt: -1 });
  }

  if (!historyRecord) {
    historyRecord = new History({
      patientId,
      attachments: [],
      reportFile: null,
    });
  }

  if (!Array.isArray(historyRecord.attachments)) {
    historyRecord.attachments = [];
  }

  const existingIds = new Set(
    historyRecord.attachments
      .filter((attachment) => attachment?.documentId)
      .map((attachment) => attachment.documentId.toString())
  );

  let added = false;

  serializedDocs.forEach((doc) => {
    const docId = doc.documentId ? doc.documentId.toString() : null;
    if (docId && existingIds.has(docId)) {
      return;
    }

    const downloadPath = doc.path || (doc.documentId ? buildDownloadPath(doc.documentId) : null);

    historyRecord.attachments.push({
      documentId: doc.documentId || null,
      filename: doc.originalName || doc.documentId || 'medical-document',
      originalName: doc.originalName || doc.filename || 'medical-document',
      mimeType: doc.mimeType || 'application/octet-stream',
      path: downloadPath,
      size: doc.size || 0,
      source: doc.source || context.source || 'unknown',
      context: doc.context || context.context || null,
      uploadedBy: doc.uploadedBy || context.uploadedBy || null,
      linkedAppointmentId: doc.appointmentId || context.linkedAppointmentId || null,
      uploadedAt: doc.uploadedAt || new Date(),
    });

    if (docId) {
      existingIds.add(docId);
    }
    added = true;
  });

  if (historyRecord.attachments.length > 0) {
    const latestAttachment = historyRecord.attachments[historyRecord.attachments.length - 1];
    if (latestAttachment) {
      historyRecord.reportFile = latestAttachment.path || latestAttachment.filename || historyRecord.reportFile;
      historyRecord.originalName = latestAttachment.originalName || historyRecord.originalName;
    }
  }

  if (!added) {
    return historyRecord;
  }

  historyRecord.markModified('attachments');
  await historyRecord.save();
  return historyRecord;
};

export default {
  attachDocumentsToHistory,
};

