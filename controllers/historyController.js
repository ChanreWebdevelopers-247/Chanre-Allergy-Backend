import History from '../models/historyModel.js';
import { attachDocumentsToHistory } from '../services/historyAttachmentService.js';

const buildDocumentDescriptors = (files = [], overrides = {}) => {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file && file.buffer)
    .map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname || file.originalName || file.filename || 'medical-document',
      mimeType: file.mimetype || file.mimeType || 'application/octet-stream',
      size: file.size || 0,
      ...overrides,
    }));
};

export const createHistory = async (req, res) => {
  try {
    // Parse JSON string
    const parsedData = req.body.formData ? JSON.parse(req.body.formData) : {};

    // Require patientId explicitly; do not fallback to user id
    const providedPatientId = parsedData.patientId || parsedData.patient;
    if (!providedPatientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }

    // Convert patientId to ObjectId if it's a string and valid
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(providedPatientId)) {
      return res.status(400).json({ message: 'Invalid patientId' });
    }

    const objectIdPatientId = new mongoose.Types.ObjectId(providedPatientId);

    // Create history record with all form data as direct fields
    let history = await History.create({
      patientId: objectIdPatientId,
      ...parsedData, // Spread all the form fields directly
    });

    const files = [];
    if (req.file) files.push(req.file);
    if (req.files && Array.isArray(req.files)) files.push(...req.files);

    if (files.length) {
      try {
        const documentDescriptors = buildDocumentDescriptors(files, {
          uploadedBy: req.user?._id || null,
          source: 'history_report',
          context: 'history_report',
          patientId: objectIdPatientId,
        });

        const updatedHistory = await attachDocumentsToHistory(objectIdPatientId, documentDescriptors, {
          historyId: history._id,
          uploadedBy: req.user?._id || null,
          source: 'history_report',
          context: 'history_report',
        });

        if (updatedHistory) {
          history = updatedHistory;
        }
      } catch (attachmentError) {
        console.error('Failed to persist history attachment:', attachmentError);
      }
    }

    const historyResponse = history?.toObject ? history.toObject() : history;

    res.status(201).json({
      message: 'Medical history saved successfully',
      data: historyResponse,
    });
  } catch (err) {
    console.error('Error saving history:', err.message);
    res.status(500).json({ message: 'Failed to save history', error: err.message });
  }
};

// Fetch a single history record by ID
export const getHistoryById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching history by ID:', id);
    
    // Validate ID
    if (!id) {
      console.log('No history ID provided');
      return res.status(400).json({ message: 'History ID is required' });
    }

    // Find the history record
    const history = await History.findById(id);
    if (!history) {
      console.log('History not found with ID:', id);
      return res.status(404).json({ message: 'History record not found' });
    }
    
    console.log('Found history record:', history._id);
    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching history by ID:', err.message);
    res.status(500).json({ message: 'Failed to fetch history', error: err.message });
  }
};

// Fetch all history records for a patient
export const getHistoryByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    // Try to find histories with multiple formats without hard failing if patient record is missing
    let histories = await History.find({ patientId }).sort({ createdAt: -1 });

    // If no results, try with ObjectId
    if (histories.length === 0) {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(patientId)) {
        histories = await History.find({
          patientId: new mongoose.Types.ObjectId(patientId)
        }).sort({ createdAt: -1 });
      }
    }

    // If still no results, try with string conversion
    if (histories.length === 0) {
      histories = await History.find({
        patientId: patientId.toString()
      }).sort({ createdAt: -1 });
    }

    // Always return 200 with array (possibly empty)
    res.status(200).json(histories);
  } catch (err) {
    console.error('Error fetching history:', err.message);
    res.status(500).json({ message: 'Failed to fetch history', error: err.message });
  }
};

// Update a history record
export const updateHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Parse JSON string if it exists
    let parsedData = {};
    if (req.body.formData) {
      parsedData = JSON.parse(req.body.formData);
    }

    // Validate ID
    if (!id) {
      return res.status(400).json({ message: 'History ID is required' });
    }

    // Find the history record
    const existingHistory = await History.findById(id);
    if (!existingHistory) {
      return res.status(404).json({ message: 'History record not found' });
    }

    // Prepare update data
    Object.assign(existingHistory, parsedData);
    await existingHistory.save();

    const files = [];
    if (req.file) files.push(req.file);
    if (req.files && Array.isArray(req.files)) files.push(...req.files);

    let historyRecord = existingHistory;

    if (files.length) {
      try {
        const documentDescriptors = buildDocumentDescriptors(files, {
          uploadedBy: req.user?._id || null,
          source: 'history_report',
          context: 'history_report_update',
          patientId: existingHistory.patientId,
        });

        const updatedHistory = await attachDocumentsToHistory(existingHistory.patientId, documentDescriptors, {
          historyId: existingHistory._id,
          uploadedBy: req.user?._id || null,
          source: 'history_report',
          context: 'history_report_update',
        });

        if (updatedHistory) {
          historyRecord = updatedHistory;
        }
      } catch (attachmentError) {
        console.error('Failed to persist updated history attachment:', attachmentError);
      }
    }

    const historyResponse = historyRecord?.toObject ? historyRecord.toObject() : historyRecord;

    res.status(200).json({
      message: 'Medical history updated successfully',
      data: historyResponse,
    });
  } catch (err) {
    console.error('Error updating history:', err.message);
    res.status(500).json({ message: 'Failed to update history', error: err.message });
  }
};
