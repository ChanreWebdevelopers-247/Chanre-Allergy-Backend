import express from 'express';
import multer from 'multer';
import { createHistory, getHistoryByPatient, getHistoryById, updateHistory } from '../controllers/historyController.js';
import { protect, ensureCenterStaffOrDoctor } from '../middleware/authMiddleware.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// POST /api/history — submit full form with optional file
router.post('/', protect, ensureCenterStaffOrDoctor, upload.single('reportFile'), createHistory);
// POST /api/history/add — alias for compatibility
router.post('/add', protect, ensureCenterStaffOrDoctor, upload.single('reportFile'), createHistory);
// PUT /api/history/:id — update history record with optional file
router.put('/:id', protect, ensureCenterStaffOrDoctor, upload.single('reportFile'), updateHistory);
// GET /api/history/:patientId — fetch all history for a patient
router.get('/:patientId', protect, getHistoryByPatient);
// GET /api/history/single/:id — fetch single history record by ID
router.get('/single/:id', protect, getHistoryById);

export default router;
