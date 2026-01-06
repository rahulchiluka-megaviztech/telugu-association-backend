import { Request, Response, NextFunction } from 'express';
import { Payment } from '../model/Payment';
import { Auth } from '../model/Auth';
import { MembershipPlan } from '../model/MembershipPlan';
import { getPayPalClient } from '../config/paypalConfig';
import paypal from '@paypal/checkout-server-sdk';
import { sendResponse } from '../Utils/errors';
import logger from '../Utils/Wiston';

// Create PayPal Order
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { membershipPlanId, userId } = req.body;

    if (!membershipPlanId || !userId) {
      sendResponse(res, 422, 'Membership plan ID and user ID are required');
      return;
    }

    // Get membership plan details
    const plan = await MembershipPlan.findByPk(membershipPlanId);
    if (!plan) {
      sendResponse(res, 404, 'Membership plan not found');
      return;
    }

    // Verify user exists
    const user = await Auth.findByPk(userId);
    if (!user) {
      sendResponse(res, 404, 'User not found');
      return;
    }

    // Create PayPal order request
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: plan.amount.toString()
        },
        description: plan.title
      }],
      application_context: {
        brand_name: 'Telugu Association',
        landing_page: 'NO_PREFERENCE' as any,
        user_action: 'PAY_NOW' as any,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      }
    } as any);

    // Execute PayPal API call
    const client = getPayPalClient();
    const order = await client.execute(request);

    // Create payment record in database
    const payment = await Payment.create({
      userId,
      membershipPlanId,
      amount: parseFloat(plan.amount.toString()),
      currency: 'USD',
      paypalOrderId: order.result.id,
      paymentStatus: 'PENDING',
      paymentMethod: 'paypal'
    });

    res.status(201).json({
      status: true,
      orderId: order.result.id,
      paymentId: payment.id
    });
  } catch (err) {
    logger.error(`createOrder error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Capture PayPal Payment
export const captureOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, userId, membershipPlanId } = req.body;

    if (!orderId) {
      sendResponse(res, 422, 'Order ID is required');
      return;
    }

    // Find payment record
    const payment = await Payment.findOne({ where: { paypalOrderId: orderId } });
    if (!payment) {
      sendResponse(res, 404, 'Payment record not found');
      return;
    }

    // Capture the order
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({} as any);

    const client = getPayPalClient();
    const capture = await client.execute(request);

    if (capture.result.status === 'COMPLETED') {
      // Extract transaction ID
      const transactionId = capture.result.purchase_units[0].payments.captures[0].id;

      // Update payment record
      await payment.update({
        paymentStatus: 'COMPLETED',
        paypalTransactionId: transactionId
      });

      // Get membership plan to calculate end date
      const plan = await MembershipPlan.findByPk(payment.membershipPlanId);
      
      // Calculate membership dates
      const startDate = new Date();
      let endDate = new Date();
      
      if (plan) {
        if (plan.duration === 'One year') {
          // Ends at current year's end (Dec 31, 11:59:59 PM)
          endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else if (plan.duration === 'Two year') {
          // Ends at next year's end (Dec 31 of following year)
          endDate = new Date(startDate.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
        } else if (plan.duration === 'Lifetime') {
          // Lifetime - set to null or very far future
          endDate = new Date('2099-12-31T23:59:59.999Z'); // Effectively never expires
        }
      }

      // Update user's membership status
      await Auth.update({
        membershipPlanId: payment.membershipPlanId,
        membershipStatus: 'active',
        membershipStartDate: startDate,
        membershipEndDate: endDate
      }, {
        where: { id: payment.userId }
      });

      res.status(200).json({
        status: true,
        message: 'Payment successful',
        transactionId,
        paymentStatus: 'COMPLETED'
      });
    } else {
      // Payment failed or pending
      await payment.update({
        paymentStatus: 'FAILED'
      });

      res.status(400).json({
        status: false,
        message: 'Payment capture failed',
        paymentStatus: capture.result.status
      });
    }
  } catch (err) {
    logger.error(`captureOrder error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Get Payment History for a User
export const getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id; // From JWT token

    const payments = await Payment.findAll({
      where: { userId },
      include: [{
        model: MembershipPlan,
        attributes: ['title', 'duration', 'amount']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: true,
      payments
    });
  } catch (err) {
    logger.error(`getPaymentHistory error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

// Handle PayPal Webhook
export const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookEvent = req.body;

    logger.info(`PayPal Webhook received: ${webhookEvent.event_type}`, { event: webhookEvent });

    // Handle different webhook event types
    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment captured successfully
        const captureId = webhookEvent.resource.id;
        await Payment.update(
          { paymentStatus: 'COMPLETED', paypalTransactionId: captureId },
          { where: { paypalOrderId: webhookEvent.resource.supplementary_data?.related_ids?.order_id } }
        );
        break;

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        // Payment failed
        await Payment.update(
          { paymentStatus: 'FAILED' },
          { where: { paypalOrderId: webhookEvent.resource.supplementary_data?.related_ids?.order_id } }
        );
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        // Payment refunded
        await Payment.update(
          { paymentStatus: 'REFUNDED' },
          { where: { paypalTransactionId: webhookEvent.resource.id } }
        );
        break;

      default:
        logger.info(`Unhandled webhook event type: ${webhookEvent.event_type}`);
    }

    res.status(200).json({ status: true, message: 'Webhook processed' });
  } catch (err) {
    logger.error(`handleWebhook error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};
