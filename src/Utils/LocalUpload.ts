import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "./Wiston";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'public/uploads');

// Create directory if it doesn't exist
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (error) {
    console.error("Error creating upload directory:", error);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^\w.-]/g, "_");
        cb(null, name + uniqueSuffix + ext);
    }
});

export const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    } 
});

/**
 * Middleware adapter to match busboy behavior
 */
export const handleLocalUpload = (req: Request, res: Response, next: NextFunction) => {
    const uploadMiddleware = upload.any();

    uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error("Multer upload error:", err);
            return res.status(500).json({ 
                error: "File upload failed.", 
                details: err instanceof Error ? err.message : "Unknown error" 
            });
        }

        if (req.files && Array.isArray(req.files)) {
             const uploadedFiles = req.files.map((file: Express.Multer.File) => {
                 // Use PUBLIC_URL if set, otherwise fallback to empty string (relative path handling depends on frontend)
                 // Assuming frontend expects a full URL or relative path from root
                 const publicUrl = process.env.PUBLIC_URL || '';
                 const fileUrl = `${publicUrl}/uploads/${file.filename}`;
                 
                 return {
                     field: file.fieldname,
                     file: fileUrl,
                     filePath: file.path // Store absolute path for deletion
                 };
             });
             (req as any).uploadedFiles = uploadedFiles;
        } else {
             (req as any).uploadedFiles = [];
        }
        next();
    });
};


/**
 * Conditional middleware - only upload if multipart/form-data
 */
export const conditionalLocalUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("multipart/form-data")) {
            handleLocalUpload(req, res, next);
        } else {
            next();
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Delete file from Local Storage
 */
export const deleteFileFromLocal = async (fileUrlOrPath: string | null) => {
    if (!fileUrlOrPath) return;

    try {
        let filePath = fileUrlOrPath;

        // If it's a URL, extract filename and construct path
        if (fileUrlOrPath.startsWith("http") || fileUrlOrPath.includes('/uploads/')) {
            const fileName = fileUrlOrPath.split('/uploads/').pop();
            console.log(`[deleteFileFromLocal] processing URL: ${fileUrlOrPath}, extracted fileName: ${fileName}`);
            if (fileName) {
                // Decode URI component in case filename has spaces/special chars
                const decodedFileName = decodeURIComponent(fileName);
                filePath = path.join(process.cwd(), 'public/uploads', decodedFileName);
                logger.info(`[deleteFileFromLocal] resolved filePath: ${filePath}`);
            } else {
                 logger.warn(`[deleteFileFromLocal] could not extract filename from URL`);
            }
        }

        // Basic protection against directory traversal & ensuring path correctness
        if (filePath && !filePath.includes(process.cwd())) {
             // If path is just a filename or relative, try to resolve it
             console.log(`[deleteFileFromLocal] path does not include cwd, trying to join with uploadDir: ${filePath}`);
             if (!filePath.includes(path.sep)) {
                  filePath = path.join(uploadDir, filePath);
             }
        }
        
        logger.info(`[deleteFileFromLocal] attempting to delete: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            logger.info(`Deleted file from Local Storage: ${filePath}`);
        } else {
            logger.warn(`File not found for deletion: ${filePath}`);
        }
    } catch (err) {
        logger.error(`Error deleting file from Local Storage: ${err}`);
    }
};
