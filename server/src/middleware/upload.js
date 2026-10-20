import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

const ALLOWED = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;

export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) cb(null, true);
    else cb(badRequest('Only images (JPG, PNG, WEBP, HEIC) and PDF files are allowed'));
  },
}).single('file');
