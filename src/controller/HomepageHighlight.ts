import { Request, Response, NextFunction } from 'express';
import { HomepageHighlight } from '../model/HomepageHighlight';
import { deleteFileFromLocal } from '../Utils/LocalUpload';
import logger from '../Utils/Wiston';

// Maximum file size: 1MB in bytes
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB = 1,048,576 bytes

export const createHighlight = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { eventName, highlightText } = req.body;
        const uploads = ((req as any).uploadedFiles || []) as {
            field: string;
            file: string;
        }[];

        // Validate required fields
        if (!eventName || !highlightText) {
            // Clean up uploaded files if validation fails
            for (const file of uploads) {
                const fileUrl = file.file;
                if (fileUrl) {
                    await deleteFileFromLocal(fileUrl).catch((err) => {
                        logger.error(`Error deleting file during validation: ${err}`);
                    });
                }
            }
            res.status(400).json({
                status: false,
                message: 'Event name and highlight text are required',
            });
            return;
        }

        let CloudFile = undefined;

        // Process uploaded image if present
        if (uploads.length > 0) {
            const file = uploads[0];
            const fileUrl = file.file;
            const imagePublicId = fileUrl.split('/').pop() || '';

            CloudFile = {
                image: fileUrl,
                imagePublicId,
            };
        }

        const highlight = await HomepageHighlight.create({
            eventName,
            highlightText,
            CloudFile,
        });

        res.status(201).json({
            status: true,
            message: 'Homepage highlight created successfully',
            data: highlight,
        });

        return;
    } catch (err) {
        logger.error(`createHighlight error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
            eventName: req.body.eventName,
            error: err,
        });
        next(err);
    }
};

export const getAllHighlights = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const { rows: highlights, count: total } = await HomepageHighlight.findAndCountAll({
            limit,
            offset,
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({
            status: true,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            highlights,
        });
    } catch (err) {
        logger.error(`getAllHighlights error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const getSingleHighlight = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id))) {
            res.status(422).json({ status: false, message: 'Invalid highlight ID' });
            return;
        }

        const highlight = await HomepageHighlight.findByPk(id);

        if (!highlight) {
            res.status(404).json({ status: false, message: 'Highlight not found' });
            return;
        }

        res.status(200).json({ status: true, data: highlight });
        return;
    } catch (err) {
        logger.error(`getSingleHighlight error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const updateHighlight = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const files = (req as any).uploadedFiles || [];

        if (!Number.isInteger(Number(id))) {
            // Clean up uploaded files
            for (const file of files) {
                const fileUrl = file.file;
                if (fileUrl) {
                    await deleteFileFromLocal(fileUrl).catch((err) => {
                        logger.error(`Error deleting file: ${err}`);
                    });
                }
            }
            res.status(422).json({ status: false, message: 'Invalid highlight ID' });
            return;
        }

        const existingHighlight = await HomepageHighlight.findByPk(id);

        if (!existingHighlight) {
            // Clean up uploaded files
            for (const file of files) {
                const fileUrl = file.file;
                if (fileUrl) {
                    await deleteFileFromLocal(fileUrl).catch((err) => {
                        logger.error(`Error deleting file: ${err}`);
                    });
                }
            }
            res.status(404).json({ status: false, message: 'Highlight not found' });
            return;
        }

        const updateFields: any = {
            eventName: req.body.eventName || existingHighlight.eventName,
            highlightText: req.body.highlightText || existingHighlight.highlightText,
        };

        // Handle image update
        if (files.length > 0) {
            const file = files[0];
            const fileUrl = file.file;
            const imagePublicId = fileUrl.split('/').pop() || '';

            let oldCloudFile = existingHighlight.CloudFile;
            if (typeof oldCloudFile === 'string') {
                try {
                    oldCloudFile = JSON.parse(oldCloudFile);
                } catch (e) {}
            }

            // Delete old image if exists
            if (oldCloudFile?.image) {
                setImmediate(async () => {
                    await deleteFileFromLocal(oldCloudFile!.image);
                });
            }

            updateFields.CloudFile = {
                image: fileUrl,
                imagePublicId,
            };
        }

        await existingHighlight.update(updateFields);

        res.status(200).json({
            status: true,
            message: 'Highlight updated successfully',
            data: existingHighlight,
        });
        return;
    } catch (err) {
        logger.error(`updateHighlight error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const deleteHighlight = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id))) {
            res.status(422).json({ status: false, message: 'Invalid highlight ID' });
            return;
        }

        const highlight = await HomepageHighlight.findByPk(id);

        if (!highlight) {
            res.status(404).json({ status: false, message: 'Highlight not found' });
            return;
        }

        let cloudFileObj = highlight.CloudFile;
        if (typeof cloudFileObj === 'string') {
            try {
                cloudFileObj = JSON.parse(cloudFileObj);
            } catch (e) {}
        }
        const imageUrl = cloudFileObj?.image;

        await highlight.destroy();

        // Delete image from InMotion hosting asynchronously
        if (imageUrl) {
            setImmediate(async () => {
                try {
                    await deleteFileFromLocal(imageUrl);
                } catch (err) {
                    logger.error(`Error deleting image for highlight ${id}: ${err}`);
                }
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Highlight deleted successfully',
        });
    } catch (err) {
        logger.error(`deleteHighlight error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const bulkDeleteHighlights = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(Number(id)))) {
            res.status(400).json({
                status: false,
                message: 'Invalid request. Please provide a non-empty array of integer IDs.',
            });
            return;
        }

        // Fetch highlights to get image URLs
        const highlights = await HomepageHighlight.findAll({
            where: {
                id: ids,
            },
        });

        if (highlights.length === 0) {
            res.status(404).json({
                status: false,
                message: 'No highlights found for the provided IDs.',
            });
            return;
        }

        // Delete images from InMotion hosting
        for (const highlight of highlights) {
            let cloudFileObj = highlight.CloudFile;
            if (typeof cloudFileObj === 'string') {
               try {
                   cloudFileObj = JSON.parse(cloudFileObj);
               } catch (e) {}
            }
            const imageUrl = cloudFileObj?.image;
            if (imageUrl) {
                setImmediate(async () => {
                    try {
                        await deleteFileFromLocal(imageUrl);
                    } catch (err) {
                        logger.error(`Error deleting image for highlight ${highlight.id}: ${err}`);
                    }
                });
            }
        }

        // Delete records from database
        const deletedCount = await HomepageHighlight.destroy({
            where: {
                id: ids,
            },
        });

        res.status(200).json({
            status: true,
            message: `${deletedCount} highlights deleted successfully`,
        });
        return;
    } catch (err) {
        logger.error(`bulkDeleteHighlights error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};
