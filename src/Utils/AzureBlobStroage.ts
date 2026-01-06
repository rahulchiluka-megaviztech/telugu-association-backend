import { Request, Response, NextFunction } from "express";
import Busboy from "busboy";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { Node_Type, PromiseType } from "./Types";
import path from "path";
import { Readable } from "stream";
import mime from 'mime-types';
import dotenv from 'dotenv'
dotenv.config()
export const uploadLargeFilesToAzure = (req: Request, res: Response, next: NextFunction): any => {
  req.body = {}; // REQUIRED

  const {
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY,
    AZURE_CONTAINER_NAME,
  } = process.env;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT_NAME!,
    AZURE_STORAGE_ACCOUNT_KEY!
  );

  const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
  );

  const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME!);

  const uploadedFiles: Array<{ field: string; file: string }> = [];
  const uploads: Promise<void>[] = [];

  const busboy = Busboy({ headers: req.headers });

  busboy.on("file", (fieldname: any, file: Readable, filename: { filename: any; }, encoding: any, mimetype: string) => {
  
  
    const rawFilename =
      typeof filename === "string"
        ? filename
        : typeof filename === "object" && filename?.filename
        ? filename.filename
        : "upload-file";
  
    const ext = path.extname(rawFilename).toLowerCase() || `.${mime.extension(mimetype) || "bin"}`;
    const baseName = path.basename(rawFilename, ext).replace(/[^\w.-]/g, "_");
    const blobName = `${Date.now()}_${baseName}${ext}`;
  
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
    const uploadPromise = blockBlobClient.uploadStream(file, 8 * 1024 * 1024, 5, {
      blobHTTPHeaders: { blobContentType: mimetype },
    }).then(() => {
      const url = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${blobName}`;
      uploadedFiles.push({ field: fieldname, file: url });
    });
  
    uploads.push(uploadPromise);
  });

  busboy.on("field", (fieldname, val) => {
    req.body[fieldname] = val;
  });

  busboy.on("finish", async () => {
    try {
      await Promise.all(uploads);
      (req as any).uploadedFiles = uploadedFiles;
      next();
  
    } catch (err) {
      res.status(500).json({ error: "Azure file upload failed." });
    }
  });
  

  req.pipe(busboy);
};


export const conditionalAzureUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      uploadLargeFilesToAzure(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
};
export const deleteFileFromAzure = async (fileUrl: string | null) => {
  if (!fileUrl) return;

  const {
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY,
    AZURE_CONTAINER_NAME
  } = process.env;

  if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY || !AZURE_CONTAINER_NAME) {
 
    return;
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY
  );

  const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
  );

  const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

  const blobName = decodeURIComponent(fileUrl.split(`/${AZURE_CONTAINER_NAME}/`)[1]);
  if (!blobName) return;

  try {
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.deleteIfExists();
  } catch (err) {
  
  }
};
