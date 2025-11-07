import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createSlitTherapyRequest,
  listReceptionistSlitTherapyRequests,
  markSlitTherapyBillPaid,
  listLabSlitTherapyRequests,
  updateSlitTherapyStatus,
  closeSlitTherapyRequest,
  cancelSlitTherapyRequest,
  refundSlitTherapyRequest
} from '../controllers/slitTherapyController.js';

const router = express.Router();

router.use(protect);

router.post('/', createSlitTherapyRequest);
router.get('/receptionist', listReceptionistSlitTherapyRequests);
router.put('/:id/mark-paid', markSlitTherapyBillPaid);
router.get('/lab', listLabSlitTherapyRequests);
router.put('/:id/status', updateSlitTherapyStatus);
router.put('/:id/close', closeSlitTherapyRequest);
router.put('/:id/cancel', cancelSlitTherapyRequest);
router.put('/:id/refund', refundSlitTherapyRequest);

export default router;

