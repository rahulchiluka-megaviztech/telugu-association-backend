import { Request, Response, NextFunction } from 'express';
import { Sponsor } from '../model/Sponsor';
import { SponsorshipPlan } from '../model/SponsorshipPlan';
import { sendResponse } from '../Utils/errors';
import logger from '../Utils/Wiston';
import { Op } from 'sequelize';
import { deleteFileFromLocal } from '../Utils/LocalUpload';

// Create a new sponsor
export const createSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, sponsorName, email, website, sponsorshipPlanId, startDate, endDate, status } = req.body;

    // Validate required fields
    if (!companyName || !sponsorName || !email || !sponsorshipPlanId || !startDate || !endDate) {
      sendResponse(res, 422, 'Company name, sponsor name, email, sponsorship plan, start date, and end date are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendResponse(res, 422, 'Invalid email format');
      return;
    }

    // Validate sponsorship plan exists
    const plan = await SponsorshipPlan.findByPk(sponsorshipPlanId);
    if (!plan) {
      sendResponse(res, 404, 'Sponsorship plan not found');
      return;
    }

    // Handle image upload (optional)
    const uploadedFiles = (req as any).uploadedFiles || [];
    
    let imageUrl = '';
    let imagePublicId = '';
    
    if (uploadedFiles.length > 0) {
      imageUrl = uploadedFiles[0].file;
      imagePublicId = uploadedFiles[0].file; // Store full URL for InMotion
    }

    // Create sponsor
    const sponsor = await Sponsor.create({
      companyName,
      sponsorName,
      email,
      website: website || '',
      sponsorshipPlanId,
      status: status || 'active',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      imageUrl,
      imagePublicId,
    });

    res.status(201).json({
      status: true,
      message: 'Sponsor created successfully',
      data: sponsor,
    });
  } catch (err) {
    logger.error(`createSponsor error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get all sponsors with pagination and filtering
export const getAllSponsors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const sponsorshipPlanId = req.query.sponsorshipPlanId as string;
    const search = req.query.search as string;

    let where: any = {};

    // Filter by status
    if (status && ['active', 'inactive'].includes(status)) {
      where.status = status;
    }

    // Filter by sponsorship plan
    if (sponsorshipPlanId && Number.isInteger(Number(sponsorshipPlanId))) {
      where.sponsorshipPlanId = sponsorshipPlanId;
    }

    // Search by company name or sponsor name
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { sponsorName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const [sponsors, total] = await Promise.all([
      Sponsor.findAll({
        where,
        limit,
        offset: skip,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: SponsorshipPlan,
            as: 'sponsorshipPlan',
            attributes: ['id', 'title', 'amount', 'benefits'],
          },
        ],
      }),
      Sponsor.count({ where }),
    ]);

    res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      sponsors,
    });
  } catch (err) {
    logger.error(`getAllSponsors error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get active sponsors only (for public display)
export const getActiveSponsors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsors = await Sponsor.findAll({
      where: { status: 'active' },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: SponsorshipPlan,
          as: 'sponsorshipPlan',
          attributes: ['id', 'title', 'amount'],
        },
      ],
    });

    res.status(200).json({
      status: true,
      sponsors,
    });
  } catch (err) {
    logger.error(`getActiveSponsors error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get a single sponsor by ID
export const getSponsorById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid sponsor ID');
      return;
    }

    const sponsor = await Sponsor.findByPk(id, {
      include: [
        {
          model: SponsorshipPlan,
          as: 'sponsorshipPlan',
          attributes: ['id', 'title', 'amount', 'benefits'],
        },
      ],
    });

    if (!sponsor) {
      sendResponse(res, 404, 'Sponsor not found');
      return;
    }

    res.status(200).json({
      status: true,
      sponsor,
    });
  } catch (err) {
    logger.error(`getSponsorById error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Update a sponsor
export const updateSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { companyName, sponsorName, email, website, sponsorshipPlanId, startDate, endDate, status } = req.body;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid sponsor ID');
      return;
    }

    const sponsor = await Sponsor.findByPk(id);

    if (!sponsor) {
      sendResponse(res, 404, 'Sponsor not found');
      return;
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        sendResponse(res, 422, 'Invalid email format');
        return;
      }
    }

    // Validate sponsorship plan if provided
    if (sponsorshipPlanId) {
      const plan = await SponsorshipPlan.findByPk(sponsorshipPlanId);
      if (!plan) {
        sendResponse(res, 404, 'Sponsorship plan not found');
        return;
      }
    }

    // Validate status if provided
    if (status && !['active', 'inactive'].includes(status)) {
      sendResponse(res, 422, 'Status must be either "active" or "inactive"');
      return;
    }

    const updateFields: any = {};
    if (companyName !== undefined) updateFields.companyName = companyName;
    if (sponsorName !== undefined) updateFields.sponsorName = sponsorName;
    if (email !== undefined) updateFields.email = email;
    if (website !== undefined) updateFields.website = website;
    if (sponsorshipPlanId !== undefined) updateFields.sponsorshipPlanId = sponsorshipPlanId;
    if (status !== undefined) updateFields.status = status;
    if (startDate !== undefined) updateFields.startDate = new Date(startDate);
    if (endDate !== undefined) updateFields.endDate = new Date(endDate);

    // Handle image upload if new image is provided
    const uploadedFiles = (req as any).uploadedFiles || [];
    
    if (uploadedFiles.length > 0) {
      // Delete old image from InMotion
      let oldImagePublicId = sponsor.imagePublicId;
      // Sponsor model doesn't use CloudFile JSON object, it uses direct columns. 
      // But verifying if imagePublicId usage is correct.
      // Based on previous file view, Sponsor has `imagePublicId` as a direct string column.
      // So NO JSON parsing needed for Sponsor if it's not using CloudFile JSON structure.
      // Checking Sponsor Create/Update logic again...
      // verified: Sponsor uses `imageUrl` and `imagePublicId` as direct fields.
      // NO CHANGE NEEDED FOR SPONSOR since it does NOT use CloudFile JSON object.
      if (sponsor.imagePublicId) {
        await deleteFileFromLocal(sponsor.imagePublicId);
      }

      // Use new image URL
      updateFields.imageUrl = uploadedFiles[0].file;
      updateFields.imagePublicId = uploadedFiles[0].file; // Store full URL for InMotion
    }

    await sponsor.update(updateFields);

    // Fetch updated sponsor with plan details
    const updatedSponsor = await Sponsor.findByPk(id, {
      include: [
        {
          model: SponsorshipPlan,
          as: 'sponsorshipPlan',
          attributes: ['id', 'title', 'amount', 'benefits'],
        },
      ],
    });

    res.status(200).json({
      status: true,
      message: 'Sponsor updated successfully',
      data: updatedSponsor,
    });
  } catch (err) {
    logger.error(`updateSponsor error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Toggle sponsor status
export const toggleSponsorStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid sponsor ID');
      return;
    }

    const sponsor = await Sponsor.findByPk(id);

    if (!sponsor) {
      sendResponse(res, 404, 'Sponsor not found');
      return;
    }

    const newStatus = sponsor.status === 'active' ? 'inactive' : 'active';
    await sponsor.update({ status: newStatus });

    res.status(200).json({
      status: true,
      message: `Sponsor ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: sponsor,
    });
  } catch (err) {
    logger.error(`toggleSponsorStatus error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete a sponsor
export const deleteSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid sponsor ID');
      return;
    }

    const sponsor = await Sponsor.findByPk(id);

    if (!sponsor) {
      sendResponse(res, 404, 'Sponsor not found');
      return;
    }

    // Delete image from InMotion
    if (sponsor.imagePublicId) {
      await deleteFileFromLocal(sponsor.imagePublicId);
    }

    await sponsor.destroy();

    res.status(200).json({
      status: true,
      message: 'Sponsor deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteSponsor error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Delete all sponsors
export const deleteAllSponsors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsors = await Sponsor.findAll();

    if (sponsors.length === 0) {
      sendResponse(res, 422, 'No sponsors found');
      return;
    }

    // Delete all images from InMotion
    for (const sponsor of sponsors) {
      if (sponsor.imagePublicId) {
        await deleteFileFromLocal(sponsor.imagePublicId);
      }
    }

    await Sponsor.destroy({ where: {} });

    res.status(200).json({
      status: true,
      message: 'All sponsors deleted successfully',
    });
  } catch (err) {
    logger.error(`deleteAllSponsors error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};
