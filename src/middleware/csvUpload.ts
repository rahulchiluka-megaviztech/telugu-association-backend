import multer from 'multer';
import path from 'path';

// Configure multer for CSV file uploads
const storage = multer.memoryStorage(); // Store file in memory for processing

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.csv') {
    return cb(new Error('Only CSV files are allowed'), false);
  }
  cb(null, true);
};

export const csvUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
