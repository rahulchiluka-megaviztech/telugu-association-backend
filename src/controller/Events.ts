import { Request, Response, NextFunction } from 'express'
import { Events } from '../model/Events'
import { Op } from 'sequelize';
import { sendResponse } from '../Utils/errors'
import { deleteFileFromLocal } from '../Utils/LocalUpload';
import moment from 'moment';
import logger from '../Utils/Wiston';

export const createEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { Eventtitle, Eventdate, Eventtime, Eventvenue, EventDescription } = req.body;
    const uploads = ((req as any).uploadedFiles || []) as {
      field: string;
      file: string;
    }[];
    if (!Eventtitle || !Eventdate || !Eventtime || !Eventvenue || !EventDescription) {
      for (const file of uploads) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => {
            next(err)
          });
        }
      }

      res.status(400).json({
        status: false,
        message: 'Eventtitle, Eventdate, Eventtime, Eventvenue and EventDescription are required',
      });
      return
    }
    const uploadedFile = uploads[0];

    let CloudFile = {
      image: '',
      imagePublicId: '',
    };

    if (uploadedFile?.file) {
      CloudFile = {
        image: uploadedFile.file,
        imagePublicId: uploadedFile.file.split('/').pop() || '',
      };
    }

    const event = await Events.create({
      Eventtitle,
      Eventdate,
      Eventtime,
      Eventvenue,
      EventDescription,
      CloudFile,
    });

    res.status(201).json({
      status: true,
      message: 'Event created successfully',
      data: event,
    });
    return
  } catch (err) {
    logger.error(`createEvents error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      eventTitle: req.body.Eventtitle,
      error: err
    });
    next(err);
  }
};

export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const type = req.query.type as string; // 'future' | 'past'

    let where: any = {};
    if (search) {
      where[Op.or] = [
        { Eventtitle: { [Op.like]: `%${search}%` } },
        { Eventvenue: { [Op.like]: `%${search}%` } },
      ];
    }
    const today = moment().format('YYYY-MM-DD');

    if (type === 'past') {
      where.Eventdate = { [Op.lt]: today };
    } else if (type === 'future') {
      where.Eventdate = { [Op.gte]: today };
    }

    const [events, total] = await Promise.all([
      Events.findAll({
        where,
        limit,
        offset: skip,
        order: [['createdAt', 'DESC']],
      }),
      Events.count({ where }),
    ]);


    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      events,
    });
  } catch (err) {
    logger.error(`getEvents error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const updateEvent = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
      return res.status(422).json({ status: false, message: 'Invalid event ID' });
    }

    const existingEvent = await Events.findByPk(id);
    if (!existingEvent) {
      for (const file of files) {
        const fileUrl = file.file;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch(console.error);
        }
      }
      return res.status(404).json({ status: false, message: 'Event not found' });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
    ];

    let CloudFile = existingEvent.CloudFile; // default to existing
    const uploadedFile = files[0];

    if (uploadedFile?.file) {
      const fileUrl = uploadedFile.file;
      const extension = fileUrl.split('.').pop() || '';
      const mime = extension.toLowerCase().startsWith('mp4') ? 'video/mp4' : `image/${extension}`;

      if (!allowedTypes.includes(mime)) {
        await deleteFileFromLocal(fileUrl).catch(console.error);
        return res.status(422).json({
          status: false,
          message: 'Only JPG, PNG, JPEG, WEBP images and MP4, WEBM, OGG, MOV videos are allowed',
        });
      }

      let existingCloudFile = existingEvent.CloudFile;
      if (typeof existingCloudFile === 'string') {
          try {
              existingCloudFile = JSON.parse(existingCloudFile);
          } catch (e) {
              console.error('Failed to parse existing CloudFile', e);
          }
      }

      const isSame = existingCloudFile?.image === fileUrl;

      if (!isSame) {
        if (existingCloudFile?.image) {
          await deleteFileFromLocal(existingCloudFile.image).catch((err) => {
            next(err)
          });
        }
        CloudFile = {
          image: fileUrl,
          imagePublicId: fileUrl.split('/').pop() || '',
        };
      }
    }

    const updateFields = {
      Eventtitle: req.body.Eventtitle || existingEvent.Eventtitle,
      Eventdate: req.body.Eventdate || existingEvent.Eventdate,
      Eventtime: req.body.Eventtime || existingEvent.Eventtime,
      Eventvenue: req.body.Eventvenue || existingEvent.Eventvenue,
      EventDescription: req.body.EventDescription || existingEvent.EventDescription,
      CloudFile,
    };

    await existingEvent.update(updateFields);
    res.status(200).json({
      status: true,
      message: uploadedFile?.file
        ? 'Event updated successfully with new file'
        : 'Event updated successfully (no new file uploaded)',
      data: existingEvent,
    });
    return;
  } catch (err) {
    logger.error(`updateEvent error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const singleEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid event Id')
      return;
    }
    const event = await Events.findByPk(id);
    res.status(200).json({ status: true, event });
    return;
  }
  catch (err) {
    logger.error(`singleEvent error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err)
  }
}


export const singledeleteImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(422).json({ status: false, message: 'Invalid event ID' });
    }

    const Event = await Events.findByPk(id);
    if (!Event) {
      return res.status(404).json({ status: false, message: 'Event not found' });
    }

    let cloudFileObj = Event.CloudFile;
    if (typeof cloudFileObj === 'string') {
        try {
            cloudFileObj = JSON.parse(cloudFileObj);
        } catch (e) {
            logger.error(`[singledeleteImage] Failed to parse CloudFile string: ${e}`);
        }
    }

    if (cloudFileObj?.image) {
      await deleteFileFromLocal(cloudFileObj.image).catch((err) => {
        next(err)
      });
    }
    Event.CloudFile = {
      image: '',
      imagePublicId: '',
    };

    await Event.save();

    return res.status(200).json({
      status: true,
      message: 'Image removed from event successfully',
    });
  } catch (err) {
    logger.error(`singledeleteImage error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const delete_all_Events = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const events = await Events.findAll();
    if (events.length === 0) {
      res.status(422).json({
        status: false,
        message: "No Event documents found",
      });
      return;
    }
    await Events.destroy({ where: {} });
    res.status(200).json({
      status: true,
      message: "All Events deleted successfully",
    });

    setImmediate(async () => {
      for (const item of events) {
        let cloudFileObj = item.CloudFile;
        if (typeof cloudFileObj === 'string') {
            try {
                cloudFileObj = JSON.parse(cloudFileObj);
            } catch (e) {
                continue;
            }
        }
        const fileUrl = cloudFileObj?.image;
        if (fileUrl) {
          await deleteFileFromLocal(fileUrl).catch((err) => {
            next(err);
          });
        }
      }
    });
  } catch (err) {
    logger.error(`delete_all_Events error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      res.status(422).json({ status: false, message: 'Invalid event ID' });
      return;
    }

    const event = await Events.findByPk(id);
    if (!event) {
      res.status(404).json({ status: false, message: 'Event not found' });
      return;
    }
    
    let cloudFileObj = event.CloudFile;
    if (typeof cloudFileObj === 'string') {
        try {
            cloudFileObj = JSON.parse(cloudFileObj);
        } catch (e) {
            logger.error(`[deleteEvent] Failed to parse CloudFile string: ${e}`);
        }
    }

    const imageUrl = cloudFileObj?.image;
    
    await event.destroy();
    
    setImmediate(async () => {
      if (imageUrl) {
        try {
          await deleteFileFromLocal(imageUrl);
        } catch (err) {
          logger.error(`Background deletion failed: ${err}`);
        }
      }
    });

    res.status(200).json({
      status: true,
      message: 'Event deleted successfully',
    });
    return;
  } catch (err) {
    logger.error(`deleteEvent error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};