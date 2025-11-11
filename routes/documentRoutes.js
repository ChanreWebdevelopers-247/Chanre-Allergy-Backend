import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  downloadDocument,
  getDocumentMetadata,
} from '../controllers/documentController.js';

const router = express.Router();

router.use(protect);

router.get('/:id/download', downloadDocument);
router.get('/:id/metadata', getDocumentMetadata);

export default router;

