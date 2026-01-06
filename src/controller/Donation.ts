import express, { Request, Response, NextFunction } from 'express';
import { Donation } from '../model/Donations';
import { getPayPalClient } from '../config/paypalConfig';
import paypal from '@paypal/checkout-server-sdk';
import { sendResponse } from '../Utils/errors';
import { Op } from 'sequelize';
import logger from '../Utils/Wiston';
import { sendCustomMail } from '../Utils/SentMail';

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstname, lastname, email, mobile, totalAmount, paymentinformation } = req.body;

    if (!totalAmount) {
      sendResponse(res, 422, 'Total amount is required');
      return;
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: totalAmount.toString(),
          },
          description: 'Donation to Telugu Association',
        },
      ],
      application_context: {
        brand_name: 'Telugu Association',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/donation/success`,
        cancel_url: `${process.env.FRONTEND_URL}/donation/cancel`,
      },
    });

    const client = getPayPalClient();
    const order = await client.execute(request);
    const orderId = order.result.id;

    // Save donation with a status of "pending"
    const donation = await Donation.create({
      firstname,
      lastname,
      email,
      mobile,
      paymentinformation: paymentinformation || 'paypal',
      orderId: orderId,
      totalAmount,
      status: 'pending',
    } as any);

    res.status(200).json({
      status: true,
      message: 'Donation order created. Proceed to payment.',
      orderId,
      data: donation,
    });
    return;
  } catch (err) {
    logger.error(`createOrder error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const donates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = (page - 1) * limit;
    const { firstname, paymentInformation, totalAmount, orderId, transactionId } = req.query;
    const where: any = {};
    if (firstname) {
      where.firstname = { [Op.like]: `%${firstname}%` };
    }
    if (paymentInformation) {
      where.paymentinformation = { [Op.like]: `%${paymentInformation}%` };
    }
    if (orderId) {
      where.orderId = { [Op.like]: `%${orderId}%` };
    }
    if (transactionId) {
      where.transactionId = { [Op.like]: `%${transactionId}%` };
    }
    if (totalAmount) {
      where.totalAmount = totalAmount;
    }
    const { rows: data, count: total } = await Donation.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json({
      status: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const captureOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      sendResponse(res, 422, 'Order ID is required');
      return;
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({} as any);

    const client = getPayPalClient();
    const capture = await client.execute(request);

    if (capture.result.status === 'COMPLETED') {
      const transactionId = capture.result.purchase_units[0].payments.captures[0].id;
      // Update the donation status in DB
      await Donation.update({ status: 'completed', transactionId }, { where: { orderId: orderId } });

      // Send confirmation email
      const donationDetails = await Donation.findOne({ where: { orderId } });
      if (donationDetails) {
        const subject = "Donation Confirmation - Telugu Association";
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #4CAF50;">Thank You, ${donationDetails.firstname}!</h1>
            <p>We have successfully received your donation.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Amount:</strong> $${donationDetails.totalAmount}</p>
              <p><strong>Transaction ID:</strong> ${transactionId}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <p>Your support helps us continue our mission. We truly appreciate your contribution.</p>
            <br>
            <p>Warm regards,</p>
            <p><strong>The Telugu Association Team</strong></p>
          </div>
        `;
        
        // Don't await this to avoid blocking the response if email service is slow
        sendCustomMail(donationDetails.email, subject, htmlContent).catch(err => 
          logger.error('Failed to send donation confirmation email', { error: err })
        );
      }

      res.status(200).json({
        status: capture.result.status,
        message: 'Order captured successfully',
        details: capture.result,
      });
    } else {
      await Donation.update({ status: 'failed' }, { where: { orderId: orderId } });
      res.status(400).json({
        status: false,
        message: 'Payment capture failed',
        paymentStatus: capture.result.status
      });
    }
    return;
  } catch (err) {
    logger.error(`captureOrder error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({ success: false, message: 'Payment was cancelled.' });
  return;
};
