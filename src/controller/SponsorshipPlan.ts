import { Request, Response, NextFunction } from 'express';
import { SponsorshipPlan } from '../model/SponsorshipPlan';
import { sendResponse } from '../Utils/errors';
import logger from '../Utils/Wiston';

// Create a new sponsorship plan
export const createSponsorshipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, amount, benefits, isActive } = req.body;

    if (!title || !amount || !benefits) {
      sendResponse(res, 422, 'Title, amount, and benefits are required');
      return;
    }

    const plan = await SponsorshipPlan.create({
      title,
      amount,
      benefits,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      status: true,
      message: 'Sponsorship plan created successfully',
      data: plan,
    });
  } catch (err) {
    logger.error(`createSponsorshipPlan error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get all sponsorship plans with pagination and filtering
export const getAllSponsorshipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive as string;

    let where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [plans, total] = await Promise.all([
      SponsorshipPlan.findAll({
        where,
        limit,
        offset: skip,
        order: [['amount', 'DESC']], // Order by price (highest to lowest)
      }),
      SponsorshipPlan.count({ where }),
    ]);

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      plans,
    });
  } catch (err) {
    logger.error(`getAllSponsorshipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get active plans only (for user selection)
export const getActiveSponsorshipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await SponsorshipPlan.findAll({
      where: { isActive: true },
      order: [['amount', 'DESC']], // Order by price
    });

    res.status(200).json({
      status: true,
      plans,
    });
  } catch (err) {
    logger.error(`getActiveSponsorshipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get a single sponsorship plan by ID
export const getSponsorshipPlanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await SponsorshipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Sponsorship plan not found');
      return;
    }

    res.status(200).json({
      status: true,
      plan,
    });
  } catch (err) {
    logger.error(`getSponsorshipPlanById error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Update a sponsorship plan
export const updateSponsorshipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, amount, benefits, isActive } = req.body;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await SponsorshipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Sponsorship plan not found');
      return;
    }

    const updateFields: any = {};
    if (title !== undefined) updateFields.title = title;
    if (amount !== undefined) updateFields.amount = amount;
    if (benefits !== undefined) updateFields.benefits = benefits;
    if (isActive !== undefined) updateFields.isActive = isActive;

    await plan.update(updateFields);

    res.status(200).json({
      status: true,
      message: 'Sponsorship plan updated successfully',
      data: plan,
    });
  } catch (err) {
    logger.error(`updateSponsorshipPlan error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Toggle plan active status
export const toggleSponsorshipPlanStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await SponsorshipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Sponsorship plan not found');
      return;
    }

    await plan.update({ isActive: !plan.isActive });

    res.status(200).json({
      status: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      data: plan,
    });
  } catch (err) {
    logger.error(`toggleSponsorshipPlanStatus error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete a sponsorship plan
export const deleteSponsorshipPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid plan ID');
      return;
    }

    const plan = await SponsorshipPlan.findByPk(id);

    if (!plan) {
      sendResponse(res, 404, 'Sponsorship plan not found');
      return;
    }

    await plan.destroy();

    res.status(200).json({
      status: true,
      message: 'Sponsorship plan deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteSponsorshipPlan error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete all sponsorship plans
export const deleteAllSponsorshipPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await SponsorshipPlan.findAll();

    if (plans.length === 0) {
      sendResponse(res, 422, 'No sponsorship plans found');
      return;
    }

    await SponsorshipPlan.destroy({ where: {} });

    res.status(200).json({
      status: true,
      message: 'All sponsorship plans deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteAllSponsorshipPlans error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};
