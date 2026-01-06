import { Request, Response, NextFunction } from 'express';
import { News } from '../model/News';
import { Events } from '../model/Events';
import { HomepageHighlight } from '../model/HomepageHighlight';
import { Sponsor } from '../model/Sponsor';
import { SponsorshipPlan } from '../model/SponsorshipPlan';
import { Op } from 'sequelize';
import logger from '../Utils/Wiston';

export const getHomeData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // Assuming YYYY-MM-DD format for string comparison

        // 1. News
        const news = await News.findAll({
            order: [['createdAt', 'DESC']]
        });

        // 2. Upcoming Events (Next 3)
        const upcomingEvents = await Events.findAll({
            where: {
                Eventdate: {
                    [Op.gte]: todayString
                }
            },
            order: [['Eventdate', 'ASC']],
            limit: 3
        });

        // 3. Homepage Highlights
        const highlights = await HomepageHighlight.findAll({
            order: [['createdAt', 'DESC']]
        });

        // 4. Sponsors
        const sponsors = await Sponsor.findAll({
            where: {
                status: 'active'
            },
            include: [
                {
                    model: SponsorshipPlan,
                    as: 'sponsorshipPlan',
                    attributes: ['id', 'title', 'amount']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: true,
            message: 'Home data fetched successfully',
            data: {
                news,
                upcomingEvents,
                highlights,
                sponsors
            }
        });
        return;

    } catch (err) {
        logger.error(`getHomeData error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};
