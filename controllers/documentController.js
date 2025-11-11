import MedicalDocument from '../models/MedicalDocument.js';
import Patient from '../models/Patient.js';
import PatientAppointment from '../models/PatientAppointment.js';
import { serializeDocument, resolveDocumentContext } from '../services/documentService.js';

const isSuperAdminUser = (user = {}) =>
  user.role === 'superadmin' ||
  user.isSuperAdminStaff === true ||
  user.userType === 'SuperAdminDoctor' ||
  user.userType === 'SuperAdminReceptionist';

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  const aStr = typeof a === 'string' ? a : a.toString();
  const bStr = typeof b === 'string' ? b : b.toString();
  return aStr === bStr;
};

const userCenterMatches = (user, centerId) => {
  if (!user || !centerId) return false;
  return idsEqual(user.centerId, centerId);
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

  if (doc.centerId && userCenterMatches(user, doc.centerId)) {
    return true;
  }

  if (await resolvePatientAccess(doc, user)) {
    return true;
  }

  if (await resolveAppointmentAccess(doc, user)) {
    return true;
  }

  // Allow lab/slitlab roles to access center-matched documents even if center not stored
  if (userHasRole(user, ['lab', 'slitlab']) && doc.centerId && userCenterMatches(user, doc.centerId)) {
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

    await hydrateDocumentContext(document);

    const authorized = await canAccessDocument(document, req.user);
    if (!authorized) {
      return res.status(403).json({ message: 'Access denied' });
    }

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

    await hydrateDocumentContext(document);

    const authorized = await canAccessDocument(document, req.user);
    if (!authorized) {
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

