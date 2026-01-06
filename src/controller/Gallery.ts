import express from 'express'
import { Request, Response, NextFunction } from 'express'
import { Gallery } from '../model/Gallery'
import { sendResponse } from '../Utils/errors'
import { deleteFileFromLocal } from '../Utils/LocalUpload'
import { Op, fn, col } from 'sequelize';
import logger from '../Utils/Wiston';

export const createGallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, year, mediaType, youtubelink } = req.body;
    const uploads = ((req as any).uploadedFiles || []) as {
      field: string;
      file: string;
    }[];
    if (!title || !year || !mediaType) {
      for (const file of uploads) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => {
            next(err);
          });
        }
      }
      return res.status(400).json({
        status: false,
        message: 'Title, year, and mediaType are required',
      });
    }
    const CloudFile = uploads.map((f) => ({
      image: f.file,
      imagePublicId: f.file.split('/').pop() || '',
    }));
    if (!CloudFile) {
      res.status(400).json({
        status: false,
        message: 'At least one media file is required',
      });
      return;
    }
    const gallery = await Gallery.create({
      title,
      year,
      mediaType,
      CloudFile,
      youtubelink,
    });
    res.status(201).json({
      status: true,
      message: 'Gallery created successfully',
      data: gallery,
    });

    return;

  } catch (err) {
    logger.error(`createGallery error: ${err instanceof Error ? err.message : 'Unknown error'} `, {
      title: req.body.title,
      year: req.body.year,
      error: err
    });
    next(err);
  }
};

export const get_Gallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 2;
    const offset = (page - 1) * limit;
    const mediaType = req.query.mediatype as string;
    const year = req.query.year as string;
    const title = req.query.title as string;
    const where: any = {};
    if (mediaType) {
      where.mediaType = mediaType;
    }
    if (year) {
      where.year = year;
    }
    if (title) {
      where.title = { [Op.like]: `% ${title}% ` };
    }
    const { rows: gallery, count: total } = await Gallery.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Build where clause for allYears query - only include mediaType filter if provided
    const yearsWhere: any = {};
    if (mediaType) {
      yearsWhere.mediaType = mediaType;
    }

    const allYears = await Gallery.findAll({
      attributes: [[fn('DISTINCT', col('year')), 'year']],
      where: yearsWhere,
      order: [['year', 'DESC']],
    });

    const allTitlesData = await Gallery.findAll({
      attributes: [[fn('DISTINCT', col('title')), 'title']],
      where: yearsWhere,
      order: [['title', 'ASC']],
    });

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      gallery,
      allYears: allYears.map((y: any) => y.year),
      allTitles: allTitlesData.map((t: any) => t.title),
    });
  } catch (err) {
    logger.error(`get_Gallery error: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};

export const update_Gallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const files = (req as any).uploadedFiles || [];
    if (!Number.isInteger(Number(id))) {
      for (const file of files) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => {
            next(err);
          });
        }
      }
      return res.status(422).json({ status: false, message: 'Invalid gallery ID' });
    }
    const existingGallery = await Gallery.findByPk(id);
    if (!existingGallery) {
      for (const file of files) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => {
            next(err);
          });
        }
      }
      return res.status(404).json({ status: false, message: 'Gallery not found' });
    }
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    ];
    const uploadedFiles: { image: string; imagePublicId: string }[] = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        const { file: fileUrl } = file;
        const extension = fileUrl.split('.').pop() || '';
        const mime = extension.toLowerCase().startsWith('mp4') ? 'video/mp4' : `image / ${extension} `;
        if (!allowedTypes.includes(mime)) {
          return res.status(422).json({
            status: false,
            message: 'Only JPG, PNG, JPEG, WEBP images and MP4, WEBM, OGG, MOV videos are allowed',
          });
        }
        const imagePublicId = fileUrl.split('/').pop()!;
        let existingCloudFile = existingGallery.CloudFile || [];
        if (typeof existingCloudFile === 'string') {
             try {
                 existingCloudFile = JSON.parse(existingCloudFile);
             } catch (e) { existingCloudFile = []; }
        }
        const isDuplicate = existingCloudFile.some(
          (f: { image: string }) => f.image === fileUrl
        );
        if (!isDuplicate) {
          uploadedFiles.push({
            image: fileUrl,
            imagePublicId,
          });
        }
      }
    }
    const updateFields: any = {
      title: req.body.title || existingGallery.title,
      year: req.body.year || existingGallery.year,
      mediaType: req.body.mediaType || existingGallery.mediaType,
      youtubelink: req.body.youtubelink || existingGallery.youtubelink,
    };
    if (uploadedFiles.length > 0) {
      let currentFiles = existingGallery.CloudFile || [];
      if (typeof currentFiles === 'string') {
          try {
              currentFiles = JSON.parse(currentFiles);
          } catch(e) { currentFiles = []; }
      }
      updateFields.CloudFile = [...currentFiles, ...uploadedFiles];
    }
    await existingGallery.update(updateFields);
    return res.status(200).json({
      status: true,
      message: uploadedFiles.length > 0
        ? 'Gallery updated successfully with new media'
        : 'Gallery updated successfully (no new media)',
      data: existingGallery,
    });
  } catch (err) {
    logger.error(`update_Gallery error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};

export const singleGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid Gallery Id');
      return;
    }
    const data = await Gallery.findByPk(id);
    res.status(200).json({ status: true, data });
    return;
  } catch (err) {
    logger.error(`singleGallery error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};

export const deleteGallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(422).json({ status: false, message: 'Invalid gallery ID' });
    }
    const gallery = await Gallery.findByPk(id);
    if (!gallery) {
      return res.status(404).json({ status: false, message: 'Gallery not found' });
    }
    let cloudFiles = gallery.CloudFile || [];
    if (typeof cloudFiles === 'string') {
        try {
            cloudFiles = JSON.parse(cloudFiles);
        } catch (e) { cloudFiles = []; }
    }
    const fileUrls = cloudFiles.map((file: any) => file.image).filter(Boolean);
    await gallery.destroy();
    setImmediate(async () => {
      try {
        await Promise.all(
          fileUrls.map(imageUrl => deleteFileFromLocal(imageUrl))
        );
      } catch (err) {
        next(err);
      }
    });
    return res.status(200).json({
      status: true,
      message: 'Gallery deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteGallery error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};

export const singledeleteImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, cloudfileId } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(422).json({ status: false, message: 'Invalid gallery ID' });
    }
    const gallery = await Gallery.findByPk(id);
    if (!gallery) {
      return res.status(404).json({ status: false, message: 'Gallery not found' });
    }
    // cloudfileId is the imagePublicId
    let cloudFiles = gallery.CloudFile || [];
    if (typeof cloudFiles === 'string') {
        try {
            cloudFiles = JSON.parse(cloudFiles);
        } catch (e) { cloudFiles = []; }
    }

    const fileToDelete = cloudFiles.find(
      (file: any) => file.imagePublicId === cloudfileId
    );
    if (!fileToDelete) {
      return res.status(404).json({ status: false, message: 'Image not found in gallery' });
    }
    if (fileToDelete.image) {
      setImmediate(async () => {
        await deleteFileFromLocal(fileToDelete.image);
      });
    }
    gallery.CloudFile = cloudFiles.filter(
      (file: any) => file.imagePublicId !== cloudfileId
    );
    await gallery.save();
    return res.status(200).json({
      status: true,
      message: 'Image deleted successfully from gallery',
    });
  } catch (err) {
    logger.error(`singledeleteImage error for ID ${req.params.id}, cloudfileId ${req.params.cloudfileId}: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};

export const delete_all_gallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mediaType = req.query.mediatype as string;

    // Build where clause based on mediaType filter
    const where: any = {};
    if (mediaType) {
      where.mediaType = mediaType;
    }

    const galleries = await Gallery.findAll({ where });
    if (galleries.length === 0) {
      return res.status(422).json({
        status: false,
        message: mediaType
          ? `No ${mediaType} gallery documents found`
          : 'No gallery documents found',
      });
    }

    await Gallery.destroy({ where });

    const message = mediaType
      ? `All ${mediaType} galleries deleted successfully`
      : 'All galleries deleted successfully';

    res.status(200).json({
      status: true,
      message,
    });
    setImmediate(async () => {
      for (const item of galleries) {
        let files = item.CloudFile || [];
        if (typeof files === 'string') {
            try {
                files = JSON.parse(files);
            } catch (e) { files = []; }
        }
        for (const file of files) {
          const fileUrl = file.image;
          if (fileUrl) {
            await deleteFileFromLocal(fileUrl).catch((err) => next(err));
          }
        }
      }
    });
  } catch (err) {
    logger.error(`delete_all_gallery error: ${err instanceof Error ? err.message : 'Unknown error'} `, { error: err });
    next(err);
  }
};
