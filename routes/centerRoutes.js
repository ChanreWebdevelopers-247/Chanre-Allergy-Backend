import express from 'express';
import {
  createCenterWithAdmin,
  getAllCenters,
  deleteCenter,
  updateCenter,
  getCenterById,
  getCenterWithAdmin,
  getCenterStats,
  getCenterByAdminId,
  updateCenterFees,
  getCenterFees
} from '../controllers/centerController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Specific routes first
router.get('/withadmin/:id', protect, getCenterWithAdmin);
router.get('/by-admin/:adminId', protect, getCenterByAdminId);
router.get('/:id/stats', protect, getCenterStats);
router.get('/:id/fees', protect, getCenterFees);
router.put('/:id/fees', protect, updateCenterFees);

router.post('/create-with-admin', createCenterWithAdmin);
router.get('/', protect, getAllCenters);
router.delete('/:id', protect, deleteCenter);
router.put('/:id', protect, updateCenter);
router.get('/:id', protect, getCenterById);

export default router;