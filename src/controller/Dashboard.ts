import { Request, Response, NextFunction } from 'express';
import { Auth } from '../model/Auth';
import { Events } from '../model/Events';
import { Sponsor } from '../model/Sponsor';
import { News } from '../model/News';
import { Op, Sequelize } from 'sequelize';
import logger from '../Utils/Wiston';

export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // Assuming YYYY-MM-DD format for string comparison

        // 1. Stats
        const activeMembersCount = await Auth.count({
            where: {
                membershipStatus: 'active',
                type: 'member'
            }
        });

        // Note: Eventdate is string, assuming YYYY-MM-DD format for comparison
        // If format is different, this might need adjustment
        const upcomingEventsCount = await Events.count({
            where: {
                Eventdate: {
                    [Op.gte]: todayString
                }
            }
        });

        const totalSponsorsCount = await Sponsor.count();

        // 2. Membership Trend (Group by Year) - JS Aggregation for stability
        const members = await Auth.findAll({
            attributes: ['membershipStartDate'],
            where: {
                membershipStartDate: {
                    [Op.not]: null as any
                }
            },
            raw: true
        });

        const trendMap: Record<string, number> = {};
        members.forEach((member: any) => {
            if (member.membershipStartDate) {
                const year = new Date(member.membershipStartDate).getFullYear().toString();
                trendMap[year] = (trendMap[year] || 0) + 1;
            }
        });

        const membershipTrend = Object.keys(trendMap).map(year => ({
            year,
            count: trendMap[year]
        })).sort((a, b) => parseInt(a.year) - parseInt(b.year));

        // 3. Upcoming Events (Next 5)
        const upcomingEvents = await Events.findAll({
            where: {
                Eventdate: {
                    [Op.gte]: todayString
                }
            },
            order: [['Eventdate', 'ASC']],
            limit: 5
        });

        const totalNewsCount = await News.count();
        const latestNews = await News.findAll({
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        res.status(200).json({
            status: true,
            message: 'Dashboard data fetched successfully',
            data: {
                stats: {
                    activeMembers: activeMembersCount,
                    upcomingEvents: upcomingEventsCount,
                    totalSponsors: totalSponsorsCount,
                    totalNews: totalNewsCount
                },
                membershipTrend,
                upcomingEvents,
                latestNews
            }
        });
        return;

    } catch (err) {
        logger.error(`getDashboardData error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
        next(err);
    }
};
