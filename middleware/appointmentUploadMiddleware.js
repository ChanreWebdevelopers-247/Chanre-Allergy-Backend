import multer from 'multer';
import path from 'path';

// Configure storage for appointment documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/appointment-docs/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'medical-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for appointment documents
const fileFilter = (req, file, cb) => {
  // Allow PDF, DOC, DOCX, JPG, JPEG, PNG files for medical documents
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, and TXT files are allowed.'), false);
  }
};

// Configure multer for appointment documents
const appointmentUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware to handle multiple files
export const uploadMedicalDocs = appointmentUpload.array('medicalHistoryDocs', 5); // Allow up to 5 files

export default appointmentUpload;

