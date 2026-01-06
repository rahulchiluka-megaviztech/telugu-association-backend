import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../Utils/errors';
import { BoardMembers } from '../model/BoardMemebers';
import { deleteFileFromLocal } from '../Utils/LocalUpload';
import { Op, fn, col } from 'sequelize';
import logger from '../Utils/Wiston';

export const createBoardMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, firstname, lastname, role } = req.body;
    const uploads = ((req as any).uploadedFiles || []) as { field: string; file: string }[];
    if (!year || !firstname || !lastname || !role) {
      for (const file of uploads) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => next(err));
        }
      }
      res.status(400).json({ status: false, message: 'year, firstname, lastname and role are required' });
      return;
    }
    const uploadedFile = uploads[0];
    let CloudFile = { image: '', imagePublicId: '' };
    if (uploadedFile?.file) {
      CloudFile = {
        image: uploadedFile.file,
        imagePublicId: uploadedFile.file.split('/').pop() || '',
      };
    }
    const member = await BoardMembers.create({ year, firstname, lastname, role, CloudFile });
    res.status(201).json({ status: true, message: 'Board member created successfully', data: member });
    return;
  } catch (err) {
    logger.error(`createBoardMember error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      year: req.body.year,
      name: `${req.body.firstname} ${req.body.lastname}`,
      error: err
    });
    next(err);
  }
};

export const getBoardMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    const year = req.query.year as string;
    const search = req.query.search as string;
    const where: any = {};
    if (year) where.year = year;
    if (search) {
      where[Op.or] = [
        { role: { [Op.like]: `%${search}%` } },
        { firstname: { [Op.like]: `%${search}%` } },
      ];
    }
    const { rows: bordmember, count: total } = await BoardMembers.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    const allYears = await BoardMembers.findAll({
      attributes: [[fn('DISTINCT', col('year')), 'year']],
      order: [['year', 'DESC']],
    });
    res.status(200).json({
      status: true,
      years: allYears.map((y: any) => y.year),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      bordmember,
    });
    return;
  } catch (err) {
    logger.error(`getBoardMembers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const updateBoardMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const files = (req as any).uploadedFiles || [];
    if (!Number.isInteger(Number(id))) {
      for (const file of files) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch(console.error);
        }
      }
      res.status(422).json({ status: false, message: 'Invalid Boardmember ID' });
      return;
    }
    const existingBoardMember = await BoardMembers.findByPk(id);
    if (!existingBoardMember) {
      for (const file of files) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch(console.error);
        }
      }
      res.status(404).json({ status: false, message: 'Board member not found' });
      return;
    }
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    ];
    let CloudFile = existingBoardMember.CloudFile;
    if (typeof CloudFile === 'string') {
        try {
            CloudFile = JSON.parse(CloudFile);
        } catch (e) {
            logger.error(`Failed to parse CloudFile string for board member ${id}: ${e}`);
        }
    }
    const uploadedFile = files[0];
    if (uploadedFile?.file) {
      const fileUrl = uploadedFile.file;
      const extension = fileUrl.split('.').pop() || '';
      const mime = extension.toLowerCase().startsWith('mp4') ? 'video/mp4' : `image/${extension}`;
      if (!allowedTypes.includes(mime)) {
        await deleteFileFromLocal(fileUrl).catch(console.error);
        res.status(422).json({ status: false, message: 'Only JPG, PNG, JPEG, WEBP images and MP4, WEBM, OGG, MOV videos are allowed' });
        return;
      }
      const isSame = existingBoardMember.CloudFile?.image === fileUrl;
      if (!isSame) {
        if (existingBoardMember?.CloudFile) {
          let oldCloudFile = existingBoardMember.CloudFile;
          if (typeof oldCloudFile === 'string') {
            try {
               oldCloudFile = JSON.parse(oldCloudFile);
            } catch (e) {}
          }
          if (oldCloudFile?.image) {
             await deleteFileFromLocal(oldCloudFile.image).catch((err) => next(err));
          }
        }
        CloudFile = {
          image: fileUrl,
          imagePublicId: fileUrl.split('/').pop() || '',
        };
      }
    }
    const updateFields = {
      year: req.body.year || existingBoardMember.year,
      firstname: req.body.firstname || existingBoardMember.firstname,
      lastname: req.body.lastname || existingBoardMember.lastname,
      role: req.body.role || existingBoardMember.role,
      CloudFile,
    };
    await existingBoardMember.update(updateFields);
    res.status(200).json({
      status: true,
      message: uploadedFile?.file
        ? 'Board Member updated successfully with new file'
        : 'Board Memeber updated successfully (no new file uploaded)',
      data: existingBoardMember,
    });
    return;
  } catch (err) {
    logger.error(`updateBoardMember error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const singleBoardMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid event Id');
      return;
    }
    const bordmember = await BoardMembers.findByPk(id);
    res.status(200).json({ status: true, bordmember });
    return;
  } catch (err) {
    logger.error(`singleBoardMember error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const deleteBoardMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      res.status(422).json({ status: false, message: 'Invalid Board Member ID' });
      return;
    }
    const boardmember = await BoardMembers.findByPk(id);
    if (!boardmember) {
      res.status(404).json({ status: false, message: 'Board member not found' });
      return;
    }
    let imageUrl = '';
    let cloudFileObj = boardmember.CloudFile;
    if (typeof cloudFileObj === 'string') {
        try {
            cloudFileObj = JSON.parse(cloudFileObj);
        } catch (e) {
             logger.error(`Failed to parse CloudFile string for board member ${id}: ${e}`);
        }
    }
    imageUrl = cloudFileObj?.image;
    await boardmember.destroy();
    setImmediate(async () => {
      if (imageUrl) {
        try {
          await deleteFileFromLocal(imageUrl);
        } catch (err) {
          next(err);
        }
      }
    });
    res.status(200).json({ status: true, message: 'boardmember deleted successfully' });
    return;
  } catch (err) {
    logger.error(`deleteBoardMember error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};
