import { Request, Response, NextFunction } from 'express';
import { News } from '../model/News';
import { sendResponse } from '../Utils/errors';
import logger from '../Utils/Wiston';

export const getAllNews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const news = await News.findAll({
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json({
            status: true,
            message: 'News fetched successfully',
            data: news,
        });
        return;
    } catch (err) {
        logger.error(`getAllNews error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const getNewsById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const news = await News.findByPk(id);

        if (!news) {
            sendResponse(res, 404, 'News not found');
            return;
        }

        res.status(200).json({
            status: true,
            message: 'News fetched successfully',
            data: news,
        });
        return;
    } catch (err) {
        logger.error(`getNewsById error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};

export const updateNews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        if (!description) {
            sendResponse(res, 422, 'Description is required');
            return;
        }

        const news = await News.findByPk(id);

        if (!news) {
            sendResponse(res, 404, 'News not found');
            return;
        }

        await news.update({ description });

        res.status(200).json({
            status: true,
            message: 'News updated successfully',
            data: news,
        });
        return;
    } catch (err) {
        logger.error(`updateNews error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};


export const createNews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { description } = req.body;

        if (!description) {
            sendResponse(res, 422, 'Description is required');
            return;
        }

        const news = await News.create({ description });

        res.status(201).json({
            status: true,
            message: 'News created successfully',
            data: news,
        });
        return;
    } catch (err) {
        logger.error(`createNews error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};
