import express from 'express';
import { protect, checkSuperAdmin } from '../middleware/authMiddleware.js';
import {
  getAllSlitLabStaff,
  getSlitLabStaffById,
  createSlitLabStaff,
  updateSlitLabStaff,
  deleteSlitLabStaff
} from '../controllers/slitLabStaffController.js';

const router = express.Router();

router.use(protect, checkSuperAdmin);

router.route('/')
  .get(getAllSlitLabStaff)
  .post(createSlitLabStaff);

router.route('/:id')
  .get(getSlitLabStaffById)
  .put(updateSlitLabStaff)
  .delete(deleteSlitLabStaff);

export default router;

