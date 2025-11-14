import MedicalDocument from '../models/MedicalDocument.js';
import Patient from '../models/Patient.js';
import PatientAppointment from '../models/PatientAppointment.js';
import History from '../models/historyModel.js';
import { serializeDocument, resolveDocumentContext } from '../services/documentService.js';

const isSuperAdminUser = (user = {}) =>
  user.role === 'superadmin' ||
  user.isSuperAdminStaff === true ||
  user.userType === 'SuperAdminDoctor' ||
  user.userType === 'SuperAdminReceptionist';

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  // Handle ObjectId, string, and null/undefined cases
  const aStr = a?.toString?.() || String(a || '');
  const bStr = b?.toString?.() || String(b || '');
  // Normalize by trimming and comparing
  const normalizedA = aStr.trim();
  const normalizedB = bStr.trim();
  return normalizedA === normalizedB && normalizedA !== '' && normalizedB !== '';
};

const userCenterMatches = (user, centerId) => {
  if (!user || !centerId) {
    console.log('userCenterMatches: missing data', { hasUser: !!user, hasCenterId: !!centerId, userCenterId: user?.centerId, centerId });
    return false;
  }
  const match = idsEqual(user.centerId, centerId);
  console.log('userCenterMatches check:', {
    userCenterId: user.centerId?.toString(),
    centerId: centerId?.toString(),
    match,
    userCenterIdType: typeof user.centerId,
    centerIdType: typeof centerId
  });
  return match;
};

const userHasRole = (user, roles = []) => roles.includes(user?.role);

const resolvePatientAccess = async (doc, user) => {
  if (!doc.patientId) {
    return false;
  }

  const patient = await Patient.findById(doc.patientId).select('centerId assignedDoctor currentDoctor superConsultantDoctor');
  if (!patient) {
    return false;
  }

  if (userCenterMatches(user, patient.centerId)) {
    return true;
  }

  if (user?.role === 'doctor') {
    const userId = user._id?.toString?.() || user.id || null;
    if (!userId) return false;

    return [
      patient.assignedDoctor,
      patient.currentDoctor,
      patient.superConsultantDoctor,
    ].some((id) => idsEqual(id, userId));
  }

  return false;
};

const resolveAppointmentAccess = async (doc, user) => {
  if (!doc.appointmentId) return false;
  const appointment = await PatientAppointment.findById(doc.appointmentId).select('centerId');
  if (!appointment) return false;
  return userCenterMatches(user, appointment.centerId);
};

const canAccessDocument = async (doc, user) => {
  if (!doc || !user) return false;
  if (isSuperAdminUser(user)) return true;

  const docId = doc._id?.toString() || doc.id?.toString();

  // For lab/slitlab roles, check history records FIRST as they often access documents through history
  if (userHasRole(user, ['lab', 'slitlab'])) {
    try {
      console.log('🔍 Lab/SlitLab access check for document:', {
        docId,
        docPatientId: doc.patientId,
        docHistoryId: doc.historyId,
        docCenterId: doc.centerId,
        userRole: user.role,
        userCenterId: user.centerId,
        userId: user._id
      });

      // First check if document has direct historyId
      if (doc.historyId) {
        const history = await History.findById(doc.historyId).select('patientId');
        if (history && history.patientId) {
          console.log('✅ Lab access GRANTED - document has historyId and history record found');
          // For lab/slitlab, if document is linked to a history record, allow access
          // They're already viewing the patient profile, so they should have access to history documents
          return true;
        }
      }

      // Search for history records that reference this document (primary check for lab/slitlab)
      // This is the most important check for lab users accessing history documents
      const historyWithDoc = await History.findOne({
        $or: [
          { 'attachments.documentId': docId },
          { 'attachments.documentId': doc._id },
          { reportFile: docId },
          { reportFile: doc._id?.toString() }
        ]
      }).select('patientId');

      if (historyWithDoc && historyWithDoc.patientId) {
        console.log('✅ Lab access GRANTED - document found in history record:', {
          historyId: historyWithDoc._id,
          patientId: historyWithDoc.patientId
        });
        // For lab/slitlab users, if we can find the document in a history record, grant access
        // They're already viewing the patient's history, so they should be able to view attached documents
        return true;
      }

      // Also check direct patientId if available - allow access if document is linked to a patient
      if (doc.patientId) {
        console.log('✅ Lab access GRANTED - document has patientId:', doc.patientId);
        // For lab/slitlab, if document is linked to a patient, allow access
        return true;
      }

      // Check centerId match (if user has centerId set)
      if (doc.centerId && user.centerId) {
        const centerMatch = userCenterMatches(user, doc.centerId);
        console.log('Direct centerId check:', { docCenterId: doc.centerId, userCenterId: user.centerId, centerMatch });
        if (centerMatch) {
          return true;
        }
      }

      // Check appointment relationship (if user has centerId set)
      if (doc.appointmentId && user.centerId) {
        const appointment = await PatientAppointment.findById(doc.appointmentId).select('centerId');
        if (appointment) {
          const centerMatch = userCenterMatches(user, appointment.centerId);
          console.log('Appointment check:', { appointmentId: doc.appointmentId, appointmentCenterId: appointment.centerId, userCenterId: user.centerId, centerMatch });
          if (centerMatch) {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in lab/slitlab document access check:', error);
    }
  }

  // Standard access checks for other roles
  if (doc.centerId && userCenterMatches(user, doc.centerId)) {
    return true;
  }

  if (await resolvePatientAccess(doc, user)) {
    return true;
  }

  if (await resolveAppointmentAccess(doc, user)) {
    return true;
  }

  return false;
};

const hydrateDocumentContext = async (document) => {
  if (!document) return document;

  const context = await resolveDocumentContext({
    centerId: document.centerId,
    patientId: document.patientId,
    appointmentId: document.appointmentId,
    historyId: document.historyId,
  });

  let hasChanges = false;
  if (!document.centerId && context.centerId) {
    document.centerId = context.centerId;
    hasChanges = true;
  }
  if (!document.patientId && context.patientId) {
    document.patientId = context.patientId;
    hasChanges = true;
  }
  if (!document.appointmentId && context.appointmentId) {
    document.appointmentId = context.appointmentId;
    hasChanges = true;
  }
  if (!document.historyId && context.historyId) {
    document.historyId = context.historyId;
    hasChanges = true;
  }

  if (hasChanges) {
    try {
      await document.save();
    } catch (error) {
      // If save fails, continue with hydrated values in memory
      console.warn('⚠️ Failed to persist hydrated document context:', error.message);
    }
  }

  return document;
};

export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline';

    const document = await MedicalDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Hydrate context first to populate missing fields
    await hydrateDocumentContext(document);

    // If still no patientId/historyId, try to find it in history records and update
    if (!document.patientId && !document.historyId) {
      try {
        const historyWithDoc = await History.findOne({
          $or: [
            { 'attachments.documentId': id },
            { 'attachments._id': id },
            { 'medicalHistoryDocs.documentId': id },
            { 'medicalHistoryDocs._id': id },
            { reportFile: id },
            { reportFileId: id }
          ]
        }).select('_id patientId');

        if (historyWithDoc) {
          document.historyId = historyWithDoc._id;
          if (historyWithDoc.patientId) {
            document.patientId = historyWithDoc.patientId;
          }
          // Save the updated context
          try {
            await document.save();
          } catch (saveError) {
            console.warn('Failed to save document context:', saveError.message);
          }
        }
      } catch (searchError) {
        console.error('Error searching for document in history:', searchError);
      }
    }

    const authorized = await canAccessDocument(document, req.user);
    if (!authorized) {
      console.error('❌ Access denied for document:', {
        documentId: id,
        userRole: req.user?.role,
        userCenterId: req.user?.centerId,
        documentPatientId: document.patientId,
        documentHistoryId: document.historyId,
        documentCenterId: document.centerId,
        userId: req.user?._id
      });
      return res.status(403).json({ message: 'Access denied' });
    }
    
    console.log('✅ Access granted for document:', {
      documentId: id,
      userRole: req.user?.role,
      userCenterId: req.user?.centerId,
      documentPatientId: document.patientId,
      documentHistoryId: document.historyId,
      documentCenterId: document.centerId
    });

    const filename = encodeURIComponent(document.originalName || `document-${document._id}`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', document.data?.length || document.size || 0);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(document.data);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Failed to download document', error: error.message });
  }
};

export const getDocumentMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await MedicalDocument.findById(id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Hydrate context first to populate missing fields
    await hydrateDocumentContext(document);

    // If still no patientId/historyId, try to find it in history records and update
    if (!document.patientId && !document.historyId) {
      try {
        // Try to find history records that reference this document
        // Check attachments array for documentId
        const historyWithDoc = await History.findOne({
          $or: [
            { 'attachments.documentId': id },
            { 'attachments.documentId': document._id },
            { reportFile: id },
            { reportFile: document._id?.toString() }
          ]
        }).select('_id patientId');

        if (historyWithDoc) {
          document.historyId = historyWithDoc._id;
          if (historyWithDoc.patientId) {
            document.patientId = historyWithDoc.patientId;
          }
          // Save the updated context
          try {
            await document.save();
          } catch (saveError) {
            console.warn('Failed to save document context:', saveError.message);
          }
        } else {
          console.log('Document not found in history records (metadata):', id);
        }
      } catch (searchError) {
        console.error('Error searching for document in history (metadata):', searchError);
      }
    }

    const authorized = await canAccessDocument(document, req.user);
    if (!authorized) {
      console.error('❌ Access denied for document metadata:', {
        documentId: id,
        userRole: req.user?.role,
        userCenterId: req.user?.centerId,
        documentPatientId: document.patientId,
        documentHistoryId: document.historyId,
        documentCenterId: document.centerId,
        userId: req.user?._id
      });
      return res.status(403).json({ message: 'Access denied' });
    }

    const metadata = serializeDocument(document);
    res.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Error fetching document metadata:', error);
    res.status(500).json({ message: 'Failed to fetch document metadata', error: error.message });
  }
};

export default {
  downloadDocument,
  getDocumentMetadata,
};

