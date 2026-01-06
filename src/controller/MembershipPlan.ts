import { Request, Response, NextFunction } from 'express';
import { MembershipPlan } from '../model/MembershipPlan';
import { Op } from 'sequelize';
import { sendResponse } from '../Utils/errors';
import logger from '../Utils/Wiston';

// Create a new membership plan
export const createMembershipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, duration, amount, benefits, isActive, validFrom, validUntil } = req.body;

    if (!title || !duration || !amount || !benefits) {
      sendResponse(res, 422, 'Title, duration, amount, and benefits are required');
      return;
    }

    // Validate duration
    if (!['One year', 'Two year', 'Lifetime'].includes(duration)) {
      sendResponse(res, 422, 'Duration must be "One year", "Two year", or "Lifetime"');
      return;
    }

    const plan = await MembershipPlan.create({
      title,
      duration,
      amount,
      benefits,
      isActive: isActive !== undefined ? isActive : true,
      validFrom,
      validUntil,
    });

    res.status(201).json({
      status: true,
      message: 'Membership plan created successfully',
      data: plan,
    });
  } catch (err) {
    logger.error(`createMembershipPlan error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get all membership plans with pagination and filtering
export const getAllMembershipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const duration = req.query.duration as string;
    const isActive = req.query.isActive as string;

    let where: any = {};

    if (duration && ['One year', 'Two year', 'Lifetime'].includes(duration)) {
      where.duration = duration;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const year = req.query.year as string;
    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      where.createdAt = {
        [Op.between]: [startDate, endDate]
      };
    }

    const [plans, total] = await Promise.all([
      MembershipPlan.findAll({
        where,
        limit,
        offset: skip,
        order: [['amount', 'ASC']], // Order by price (lowest to highest)
      }),
      MembershipPlan.count({ where }),
    ]);

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      plans,
    });
  } catch (err) {
    logger.error(`getAllMembershipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get active plans only (for user selection)
export const getActiveMembershipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await MembershipPlan.findAll({
      where: { isActive: true },
      order: [['amount', 'ASC']], // Order by price
    });

    res.status(200).json({
      status: true,
      plans,
    });
  } catch (err) {
    logger.error(`getActiveMembershipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get a single membership plan by ID
export const getMembershipPlanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await MembershipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Membership plan not found');
      return;
    }

    res.status(200).json({
      status: true,
      plan,
    });
  } catch (err) {
    logger.error(`getMembershipPlanById error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Update a membership plan
export const updateMembershipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, duration, amount, benefits, isActive, validFrom, validUntil } = req.body;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await MembershipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Membership plan not found');
      return;
    }

    // Validate duration if provided
    if (duration && !['One year', 'Two year', 'Lifetime'].includes(duration)) {
      sendResponse(res, 422, 'Duration must be "One year", "Two year", or "Lifetime"');
      return;
    }

    const updateFields: any = {};
    if (title !== undefined) updateFields.title = title;
    if (duration !== undefined) updateFields.duration = duration;
    if (amount !== undefined) updateFields.amount = amount;
    if (benefits !== undefined) updateFields.benefits = benefits;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (validFrom !== undefined) updateFields.validFrom = validFrom;
    if (validUntil !== undefined) updateFields.validUntil = validUntil;

    await plan.update(updateFields);

    res.status(200).json({
      status: true,
      message: 'Membership plan updated successfully',
      data: plan,
    });
  } catch (err) {
    logger.error(`updateMembershipPlan error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Toggle plan active status
export const togglePlanStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await MembershipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Membership plan not found');
      return;
    }

    await plan.update({ isActive: !plan.isActive });

    res.status(200).json({
      status: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      data: plan,
    });
  } catch (err) {
    logger.error(`togglePlanStatus error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete a membership plan
export const deleteMembershipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await MembershipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Membership plan not found');
      return;
    }

    await plan.destroy();

    res.status(200).json({
      status: true,
      message: 'Membership plan deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteMembershipPlan error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete all membership plans
export const deleteAllMembershipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await MembershipPlan.findAll();

    if (plans.length === 0) {
      sendResponse(res, 422, 'No membership plans found');
      return;
    }

    await MembershipPlan.destroy({ where: {} });

    res.status(200).json({
      status: true,
      message: 'All membership plans deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteAllMembershipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};
