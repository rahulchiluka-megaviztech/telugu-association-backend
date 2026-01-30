import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { Auth } from '../model/Auth';
import { MembershipPlan } from '../model/MembershipPlan';
import { Payment } from '../model/Payment';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { sendResponse, strongPasswordRegex } from '../Utils/errors';
import { sendMail, sendCustomMail } from '../Utils/SentMail';
import { OTP } from '../model/otp';
import logger from '../Utils/Wiston';
import { welcomeEmailTemplate } from '../Utils/EmailTemplate';
import { Op } from 'sequelize';
import * as XLSX from 'xlsx';
import path from 'path';

export const MemberAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, email } = req.body;
    const exist = await Auth.findOne({ where: { email } });
    if (exist) {
      sendResponse(res, 409, 'Member Already exist');
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const data = await Auth.create({ ...req.body, email, password: hash });
    res.status(200).json({ status: true, message: 'Register Successfully', memeber: data });
    return;
  } catch (err) {
    next(err);
  }
};

export const MemberAuth_Confirm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid Id');
      return;
    }
    await Auth.update({ confirm: true }, { where: { id } });
    res.status(200).json({ status: true, message: 'Member Confirmed Successfully' });
    return;
  } catch (err) {
    logger.error(`MemberAuth_Confirm error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const MemberAuth_Edit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid Id');
      return;
    }
    const { password, email, confirmpassword, ...rest } = req.body;
    let updateFields: any = { ...rest };
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        sendResponse(res, 422, 'Invalid email format');
        return;
      }
      updateFields.email = email;
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordRegex.test(password)) {
        sendResponse(res, 422, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        return;
      }
      if (password !== confirmpassword) {
        sendResponse(res, 422, 'Password and Confirm Password do not match');
        return;
      }
      const hash = await bcrypt.hash(password, salt);
      updateFields.password = hash;
    }

    // Special handling for Admin email change
    if (email) {
      const user = await Auth.findByPk(id);
      
      // If user is Admin and email is actually changing
      if (user && user.IsAdmin && user.email !== email) {
        // Check if new email is already taken
        const existingEmail = await Auth.findOne({ where: { email } });
        if (existingEmail) {
          sendResponse(res, 409, 'Email already in use');
          return;
        }

        // Generate and send OTP
        const otpValue = Math.floor(1000 + Math.random() * 9000).toString();
        await OTP.upsert({ email, otp: otpValue }); // Save OTP for the NEW email
        
        await sendMail(email, otpValue);

        // Remove email from immediate update
        delete updateFields.email;

        // Perform other updates first
        await Auth.update(updateFields, { where: { id } });

        res.status(200).json({ 
          status: true, 
          message: 'Profile updated. OTP sent to new email for verification.',
          verificationRequired: true
        });
        return;
      }
    }

    await Auth.update(updateFields, { where: { id } });

    // --- CHECK PROFILE COMPLETENESS ---
    // Fetch the updated user data to verify all fields
    const updatedUser = await Auth.findByPk(id);
    if (updatedUser) {
      const requiredFields = [
        'firstname',
        'lastname',
        'email',
        'mobile',
        'address',
        'city',
        'state',
        'country',
        'zipcode'
      ];

      // Check if every required field has a truthy value
      const isComplete = requiredFields.every((field) => {
        const value = (updatedUser as any)[field];
        return value && value.toString().trim() !== '';
      });

      // Update isProfileComplete if it has changed
      if (updatedUser.isProfileComplete !== isComplete) {
        await Auth.update({ isProfileComplete: isComplete }, { where: { id } });
      }
    }

    res.status(200).json({ status: true, message: 'sucessfully updated' });
    return;
  } catch (err) {
    logger.error(`MemberAuth_Edit error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const verifyEmailChange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { email, otp } = req.body;

    if (!email || !otp) {
      sendResponse(res, 422, 'Email and OTP are required');
      return;
    }

    // Verify OTP
    const otpRecord = await OTP.findOne({ where: { email, otp } });
    if (!otpRecord) {
      sendResponse(res, 422, 'Invalid or expired OTP');
      return;
    }

    // Check if email is still available (race condition check)
    const existingUser = await Auth.findOne({ where: { email } });
    if (existingUser) {
      sendResponse(res, 409, 'Email already in use');
      return;
    }

    // Update user's email
    await Auth.update({ email }, { where: { id: userId } });
    
    // Clear OTP
    await otpRecord.destroy();

    res.status(200).json({ status: true, message: 'Email updated successfully' });
    return;
  } catch (err) {
    logger.error(`verifyEmailChange error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const MemberAuth_getData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      sendResponse(res, 422, 'Invalid Id');
      return;
    }
    
    const data = await Auth.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: MembershipPlan,
          as: 'membershipPlan',
          attributes: ['id', 'title', 'duration', 'amount']
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'currency', 'paymentMethod', 'paypalTransactionId', 'paymentStatus', 'createdAt']
        }
      ]
    });
    
    if (!data) {
      sendResponse(res, 404, 'Member not found');
      return;
    }
    
    res.status(200).json({ status: true, message: 'Member Data', data });
    return;
  } catch (err) {
    logger.error(`MemberAuth_getData error for ID ${req.params.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const SignIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      sendResponse(res, 422, 'All fields are required');
      return;
    }
    const exist: any = await Auth.findOne({ where: { email } });
    if (!exist) {
      sendResponse(res, 422, 'Account does not exist');
      return;
    }
    // if (!exist.confirm) {
    //   sendResponse(res, 422, 'Account Not verified');
    //   return;
    // }
    const isPassword = await bcrypt.compare(password, exist.password);
    if (!isPassword) {
      sendResponse(res, 422, 'Invalid Password');
      return;
    }
    const payload = {
      user: {
        id: exist.id,
      },
    };
    const accesstoken = jwt.sign(payload, process.env.JWTKEY as string, { expiresIn: '100d' });
    res.status(200).json({
      status: true,
      message: 'successfully login',
      userid: exist.id,
      user: exist.IsAdmin ? 'admin' : exist.type,
      accesstoken: accesstoken,
    });
    return;
  } catch (err) {
    logger.error(`SignIn error for email ${req.body.email}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const ForgetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      sendResponse(res, 422, 'Email is Required');
      return;
    }
    const exist = await Auth.findOne({ where: { email } });
    if (!exist) {
      sendResponse(res, 422, 'Enter registered email id');
      return;
    }

    const OTPValue = Math.floor(1000 + Math.random() * 9000).toString();
    const [data, mail] = await Promise.all([
      OTP.upsert({ email, otp: OTPValue }),
      sendCustomMail(email, 'Forget Password OTP', `Your OTP is ${OTPValue}`)
    ]);
    res.status(200).json({ status: true, message: 'OTP sent to Email', data: [data, mail] });

  } catch (err) {
    logger.error(`ForgetPassword error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const AdminForgetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      sendResponse(res, 422, 'Email is Required');
      return;
    }
    const exist = await Auth.findOne({ where: { email } });
    
    // Strict Admin Check
    if (!exist || (!exist.IsAdmin && exist.type !== 'admin')) {
      sendResponse(res, 422, 'Enter registered email id');
      return;
    }

    const OTPValue = Math.floor(1000 + Math.random() * 9000).toString();
    const [data, mail] = await Promise.all([
      OTP.upsert({ email, otp: OTPValue }),
      sendCustomMail(email, 'Admin Forget Password OTP', `Your Admin OTP is ${OTPValue}`)
    ]);
    res.status(200).json({ status: true, message: 'OTP sent to Email', data: [data, mail] });

  } catch (err) {
    logger.error(`AdminForgetPassword error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const ChangePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, newPassword, confirmPassword } = req.body
    const exist = await Auth.findOne({ where: { email } })
    if (!exist) {
      sendResponse(res, 422, 'Enter register email address')
      return
    }

    if (!newPassword || !confirmPassword) {
      sendResponse(res, 422, 'All fileds are Required')
      return
    }
    if (!strongPasswordRegex.test(newPassword)) {
      sendResponse(res, 422, 'Password must contain at least 8 characters, including at least one uppercase letter, one lowercase letter, one number, and one special character.')
      return

    }
    if (newPassword !== confirmPassword) {
      sendResponse(res, 422, 'Passwords do not match')
      return
    }
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(newPassword, salt)
    await Auth.update({ password: hash }, { where: { email } })
    res.status(200).json({ message: 'password changed successfully' })
    return
  }
  catch (err) {
    logger.error(`ChangePassword error for email ${req.body.email}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err)
  }
};

export const VerifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    const otpRecord = await OTP.findOne({ where: { email } });
    if (!otpRecord) {
      return sendResponse(res, 422, 'OTP expired or not found');
    }
    if (!otp) {
      sendResponse(res, 422, 'OTP is required');
      return;
    }
    if (otpRecord.otp !== otp) {
      sendResponse(res, 422, 'Invalid OTP');
      return;
    }
    await otpRecord.destroy(); // Remove OTP after successful verification
    res.status(200).json({ status: true, message: 'OTP verified successfully' });
    return;
  } catch (err) {
    next(err);
  }
};

export const UpdatePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id; // From JWT token via authenticate middleware
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      sendResponse(res, 422, 'All fields are required');
      return;
    }

    // Fetch user from database
    const user = await Auth.findByPk(userId);
    if (!user) {
      sendResponse(res, 404, 'User not found');
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      sendResponse(res, 422, 'Current password is incorrect');
      return;
    }

    // Validate new password strength
    if (!strongPasswordRegex.test(newPassword)) {
      sendResponse(res, 422, 'Password must contain at least 8 characters, including at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }

    // Verify new password matches confirm password
    if (newPassword !== confirmPassword) {
      sendResponse(res, 422, 'New password and confirm password do not match');
      return;
    }

    // Hash and update new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await Auth.update({ password: hash }, { where: { id: userId } });

    res.status(200).json({ status: true, message: 'Password updated successfully' });
    return;
  } catch (err) {
    logger.error(`UpdatePassword error for user ID ${(req as any).user?.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

 

export const GoogleSignIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      sendResponse(res, 422, 'Token is required');
      return;
    }

    let payload: any;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {
      // 1. Try verifying as ID Token (JWT)
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (idTokenError: any) {
      // 2. Fallback: Try as Access Token (Common for some frontend web/mobile setups)
      try {
        const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = response.data;
        payload = {
          email: data.email,
          sub: data.sub,
          given_name: data.given_name,
          family_name: data.family_name,
          picture: data.picture,
        };
      } catch (accessTokenError: any) {
        logger.error(`GoogleSignIn failed: ID Token error: ${idTokenError.message}. Access Token error: ${accessTokenError.message}`);
        sendResponse(res, 422, 'Invalid Google Token');
        return;
      }
    }

    if (!payload) {
      sendResponse(res, 422, 'Invalid Token Data');
      return;
    }

    const { email, sub: googleId, given_name: firstname, family_name: lastname, picture: profilePicture } = payload;

    if (!email) {
      sendResponse(res, 422, 'Email not found in token');
      return;
    }

    let user = await Auth.findOne({ where: { email } });

    if (!user) {
      // Create new user
      user = await Auth.create({
        email,
        socialId: googleId,
        authProvider: 'google',
        firstname: firstname || '',
        lastname: lastname || '',
        type: 'member',
        confirm: true, // Auto-confirm Google users
        isProfileComplete: false,
        profilePicture
      } as any);
    } else if (!user.socialId) {
      // Link existing user
      await user.update({ socialId: googleId, authProvider: 'google', profilePicture });
    }

    const jwtPayload = {
      user: {
        id: user.id,
      },
    };
    const accesstoken = jwt.sign(jwtPayload, process.env.JWTKEY as string, { expiresIn: '100d' });

    res.status(200).json({
      status: true,
      message: 'successfully login',
      userid: user.id,
      user: user.IsAdmin ? 'admin' : 'member',
      accesstoken: accesstoken,
    });
    return;

  } catch (err) {
    logger.error(`GoogleSignIn error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const FacebookSignIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      sendResponse(res, 422, 'Access token is required');
      return;
    }

    // Verify token with Facebook Graph API
    const response = await axios.get(`https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${accessToken}`);
    const { id: facebookId, email, first_name: firstname, last_name: lastname, picture } = response.data;

    if (!email) {
      sendResponse(res, 422, 'Email not found in Facebook account');
      return;
    }

    let user = await Auth.findOne({ where: { email } });

    if (!user) {
      // Create new user
      user = await Auth.create({
        email,
        socialId: facebookId,
        authProvider: 'facebook',
        firstname: firstname || '',
        lastname: lastname || '',
        type: 'member',
        confirm: true, // Auto-confirm Facebook users
        isProfileComplete: false,
        profilePicture: picture?.data?.url
      } as any);
    } else if (!user.socialId) {
      // Link existing user
      await user.update({ 
        socialId: facebookId, 
        authProvider: 'facebook', 
        profilePicture: picture?.data?.url 
      });
    }

    const jwtPayload = {
      user: {
        id: user.id,
      },
    };
    const accesstoken = jwt.sign(jwtPayload, process.env.JWTKEY as string, { expiresIn: '100d' });

    res.status(200).json({
      status: true,
      message: 'successfully login',
      userid: user.id,
      user: user.IsAdmin ? 'admin' : 'member',
      accesstoken: accesstoken,
    });
    return;

  } catch (err) {
    logger.error(`FacebookSignIn error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const getAllMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const { duration, search } = req.query;

    const membershipWhere: any = {};
    if (duration) {
      membershipWhere.duration = duration;
    }

    const memberWhere: any = {
      type: 'member'
    };

    // Search by firstname, lastname, email, or mobile
    if (search) {
      memberWhere[Op.or] = [
        { firstname: { [Op.like]: `%${search}%` } },
        { lastname: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows: data, count: total } = await Auth.findAndCountAll({
      where: memberWhere,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] },
      include: [
        {
          model: MembershipPlan,
          as: 'membershipPlan',
          attributes: ['duration'],
          where: membershipWhere,
          required: !!duration // If duration is provided, inner join. Else left join.
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    const formattedData = data.map((member: any) => {
      const memberData = member.toJSON();
      const {
        membershipPlanId,
        membershipStatus,
        membershipStartDate,
        membershipEndDate,
        membershipPlan,
        payments,
        ...rest
      } = memberData;

      return {
        ...rest,
        membership: {
          membershipPlanId,
          membershipStatus,
          membershipStartDate,
          membershipEndDate,
          type: membershipPlan ? membershipPlan.duration : null
        },
        transactions: payments || []
      };
    });

    res.status(200).json({
      status: true,
      message: 'Members fetched successfully',
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      data: formattedData,
    });
    return;
  } catch (err) {
    logger.error(`getAllMembers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const deleteMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      sendResponse(res, 422, 'Please provide an array of member IDs to delete');
      return;
    }

    const deletedCount = await Auth.destroy({
      where: {
        id: ids
      }
    });

    if (deletedCount === 0) {
      sendResponse(res, 404, 'No members found to delete');
      return;
    }

    res.status(200).json({
      status: true,
      message: `${deletedCount} member(s) deleted successfully`
    });
    return;
  } catch (err) {
    logger.error(`deleteMembers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    
    const data = await Auth.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: MembershipPlan,
          as: 'membershipPlan',
          attributes: ['id', 'title', 'duration', 'amount']
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'currency', 'paymentMethod', 'paypalTransactionId', 'paymentStatus', 'createdAt']
        }
      ]
    });
    
    if (!data) {
      sendResponse(res, 404, 'Profile not found');
      return;
    }
    
    res.status(200).json({ status: true, message: 'Profile Data', data });
    return;
  } catch (err) {
    logger.error(`getProfile error for ID ${(req as any).user?.id}: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const adminAddMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      paymentMethod, 
      transactionId, 
      subscriptionPlan,
      startDate,
      endDate
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !paymentMethod || !transactionId || !subscriptionPlan) {
      sendResponse(res, 422, 'All fields are required: First Name, Last Name, Email, Phone Number, Payment Method, Transaction Id, Subscription Plan');
      return;
    }

    // Validate dates for non-lifetime plans
    if (subscriptionPlan !== 'Lifetime' && (!startDate || !endDate)) {
      sendResponse(res, 422, 'Start Date and End Date are required for this plan');
      return;
    }

    // Check if user already exists
    const exist = await Auth.findOne({ where: { email } });
    if (exist) {
      sendResponse(res, 409, 'Member with this email already exists');
      return;
    }

    // Map subscriptionPlan to DB enum values
    let dbDuration = subscriptionPlan;
    if (subscriptionPlan === 'One Year') dbDuration = 'One year';
    if (subscriptionPlan === 'Two Year') dbDuration = 'Two year';

    // Find active membership plan by duration
    // We assume there's only one active plan per duration, or we pick the latest/first one.
    const plan = await MembershipPlan.findOne({
      where: { 
        duration: dbDuration,
        isActive: true
      }
    });

    if (!plan) {
      sendResponse(res, 404, `Active membership plan for '${subscriptionPlan}' not found`);
      return;
    }

    // Determine dates
    // Determine dates
    let finalStartDate = startDate ? new Date(startDate) : new Date();
    let finalEndDate: Date;

    if (subscriptionPlan === 'Lifetime') {
      // If dates provided, use them, otherwise set default lifetime duration (e.g. 100 years)
      if (endDate) {
        finalEndDate = new Date(endDate);
      } else {
        finalEndDate = new Date(finalStartDate);
        finalEndDate.setFullYear(finalEndDate.getFullYear() + 100);
        // Lifetime doesn't need to be Dec 31st necessarily, can keep specific date
      }
    } else {
      // Parse duration from plan name (e.g., "One year", "Two years", "Five years")
      let yearsToAdd = 0;
      if (subscriptionPlan.toLowerCase().includes('one')) yearsToAdd = 1;
      else if (subscriptionPlan.toLowerCase().includes('two')) yearsToAdd = 2;
      else yearsToAdd = 1; // Default fallback

      finalEndDate = new Date(finalStartDate);
      // Logic: One year plan ends in the SAME year. Two years ends in NEXT year.
      // So we add (yearsToAdd - 1) to the current year.
      finalEndDate.setFullYear(finalEndDate.getFullYear() + (yearsToAdd - 1));
      
      finalEndDate.setMonth(11); // December (0-indexed)
      finalEndDate.setDate(31);
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create member
    const newMember = await Auth.create({
      firstname: firstName,
      lastname: lastName,
      email,
      mobile: phoneNumber,
      password: hashedPassword,
      type: 'member',
      confirm: true, // Auto-confirm admin added members
      membershipPlanId: plan.id,
      membershipStatus: 'active',
      membershipStartDate: finalStartDate,
      membershipEndDate: finalEndDate,
      isProfileComplete: true,
      authProvider: 'local',
      state: '', 
      city: '',
      country: '',
      zipcode: '',
      address: '',
      address2: '',
      paymentinformation: paymentMethod,
    } as any);

    // Send welcome email
    await sendCustomMail(
      email,
      'Welcome to Telugu Association - Your Account Details',
      welcomeEmailTemplate(email, password)
    );

    // Create payment record
    await Payment.create({
      userId: newMember.id,
      membershipPlanId: plan.id,
      amount: plan.amount, // Use amount from the plan
      currency: 'USD',
      paymentMethod,
      paypalTransactionId: transactionId,
      paymentStatus: 'COMPLETED',
    });

    res.status(201).json({
      status: true,
      message: 'Member added successfully',
      data: newMember
    });
    return;
  } catch (err) {
    logger.error(`adminAddMember error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const adminEditMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      mobile,
      subscriptionPlan,
      paymentMethod,
      transactionId,
      startDate,
      endDate,
      membershipStatus
    } = req.body;

    const member = await Auth.findOne({
      where: {
        id,
        type: 'member'
      }
    });

    if (!member) {
      sendResponse(res, 404, 'Member not found');
      return;
    }

    if (firstName) member.firstname = firstName;
    if (lastName) member.lastname = lastName;
    if (email) member.email = email;
    if (mobile) member.mobile = mobile;
    if (paymentMethod) member.paymentinformation = paymentMethod;
    if (membershipStatus) member.membershipStatus = membershipStatus;

    if (subscriptionPlan) {
      // Normalize the subscription plan to match database format
      const normalizedPlan = subscriptionPlan.toLowerCase() === 'lifetime' 
        ? 'Lifetime'
        : subscriptionPlan.replace(/year/i, 'year'); // Convert "Year" to "year"
      
      const plan = await MembershipPlan.findOne({
        where: { duration: normalizedPlan }
      });

      if (!plan) {
        sendResponse(res, 404, `Membership plan "${subscriptionPlan}" not found`);
        return;
      }

      member.membershipPlanId = plan.id;
    }

    if (startDate) {
      member.membershipStartDate = new Date(startDate);
    }

    if (subscriptionPlan || startDate) {
      // Recalculate end date if plan or start date changes
      const currentPlanId = member.membershipPlanId;
      const currentPlan = await MembershipPlan.findByPk(currentPlanId);
      
      if (currentPlan) {
        if (currentPlan.duration.toLowerCase() === 'lifetime') {
           if (!member.membershipEndDate) {
              const newEnd = new Date(member.membershipStartDate);
              newEnd.setFullYear(newEnd.getFullYear() + 100);
              member.membershipEndDate = newEnd;
           }
        } else {
           // Parse duration
           let yearsToAdd = 1;
           const durationLower = currentPlan.duration.toLowerCase();
           if (durationLower.includes('one')) yearsToAdd = 1;
           else if (durationLower.includes('two')) yearsToAdd = 2;

           const newEnd = new Date(member.membershipStartDate);
           newEnd.setFullYear(newEnd.getFullYear() + (yearsToAdd - 1));
           newEnd.setMonth(11); // Dec
           newEnd.setDate(31);  // 31st
           member.membershipEndDate = newEnd;
        }
      }
    } else if (endDate) {
      // If manually setting endDate (and not changing plan to affect it logic)
      const newEndDate = new Date(endDate);
      const plan = await MembershipPlan.findByPk(member.membershipPlanId);
      const isLifetime = plan?.duration.toLowerCase() === 'lifetime';

      if (!isLifetime) {
        newEndDate.setMonth(11);
        newEndDate.setDate(31);
      }
      member.membershipEndDate = newEndDate;
    }

    await member.save();

    if (transactionId) {
      await Payment.update(
        {
          paymentMethod: paymentMethod || member.paymentinformation,
          paypalTransactionId: transactionId
        },
        {
          where: {
            userId: member.id
          },
          limit: 1
        }
      );
    }

    res.status(200).json({
      status: true,
      message: 'Member updated successfully',
      data: member
    });
    return;
  } catch (err) {
    logger.error(`adminEditMember error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const volunteerRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      password,
      confirmPassword,
      state,
      city,
      country,
      zipcode,
      address,
      address2
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !mobile || !password || !confirmPassword || !state || !city || !country || !zipcode || !address) {
      sendResponse(res, 422, 'All fields are required');
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      sendResponse(res, 422, 'Passwords do not match');
      return;
    }

    // Check if user exists
    const existingUser = await Auth.findOne({ where: { email } });
    if (existingUser) {
      sendResponse(res, 409, 'User with this email already exists');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newVolunteer = await Auth.create({
      firstname: firstName,
      lastname: lastName,
      email,
      mobile,
      password: hashedPassword,
      type: 'volunteer',
      confirm: true,
      volunteerStatus: 'active',
      isProfileComplete: true,
      authProvider: 'local',
      state,
      city,
      country,
      zipcode,
      address,
      address2
    } as any);

    res.status(201).json({
      status: true,
      message: 'Volunteer registered successfully',
      data: newVolunteer
    });
    return;
  } catch (err) {
    logger.error(`volunteerRegistration error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const getAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    
    // Fetch admin data
    const admin = await Auth.findOne({
      where: { 
        id: userId,
        IsAdmin: true
      },
      attributes: { exclude: ['password'] }
    });

    if (!admin) {
      sendResponse(res, 404, 'Admin profile not found');
      return;
    }

    res.status(200).json({
      status: true,
      message: 'Admin profile fetched successfully',
      data: admin
    });
    return;
  } catch (err) {
    logger.error(`getAdminProfile error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const adminAddVolunteer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      hoursPerMonth // This will be mapped to volunteerHours
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !mobile) {
      sendResponse(res, 422, 'First Name, Last Name, Email and Phone are required');
      return;
    }

    // Check if user exists
    const existingUser = await Auth.findOne({ where: { email } });
    if (existingUser) {
      sendResponse(res, 409, 'User with this email already exists');
      return;
    }

    // Generate random 8-char password
    const password = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create volunteer
    const newVolunteer = await Auth.create({
      firstname: firstName,
      lastname: lastName,
      email,
      mobile,
      password: hashedPassword,
      type: 'volunteer',
      confirm: true,
      membershipStatus: 'inactive',
      volunteerStatus: 'active',
      isProfileComplete: true,
      authProvider: 'local',
      volunteerHours: hoursPerMonth || '', // Store hours here
      paymentinformation: '', 
      // Default empty strings for address fields as they are not provided in admin form
      state: '',
      city: '',
      country: '',
      zipcode: '',
      address: '',
      address2: ''
    } as any);

    // Send welcome email
    const emailHtml = welcomeEmailTemplate(email, password);
    await sendCustomMail(email, 'Welcome to Telugu Association - Volunteer Account Created', emailHtml);

    res.status(201).json({
      status: true,
      message: 'Volunteer added successfully',
      data: newVolunteer
    });
    return;
  } catch (err) {
    logger.error(`adminAddVolunteer error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const adminEditVolunteer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      mobile,
      hoursPerMonth,
      volunteerStatus
    } = req.body;

    const volunteer = await Auth.findOne({
      where: {
        id,
        type: 'volunteer'
      }
    });

    if (!volunteer) {
      sendResponse(res, 404, 'Volunteer not found');
      return;
    }

    if (firstName) volunteer.firstname = firstName;
    if (lastName) volunteer.lastname = lastName;
    if (email) volunteer.email = email;
    if (mobile) volunteer.mobile = mobile;
    if (hoursPerMonth !== undefined) volunteer.volunteerHours = hoursPerMonth;
    if (volunteerStatus) volunteer.volunteerStatus = volunteerStatus;

    await volunteer.save();

    res.status(200).json({
      status: true,
      message: 'Volunteer updated successfully',
      data: volunteer
    });
    return;
  } catch (err) {
    logger.error(`adminEditVolunteer error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


export const getAllVolunteers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: volunteers } = await Auth.findAndCountAll({
      where: {
        type: 'volunteer'
      },
      attributes: ['id', 'firstname', 'lastname', 'email', 'mobile', 'volunteerHours', 'volunteerStatus', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: true,
      message: 'Volunteers fetched successfully',
      data: volunteers,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
    return;
  } catch (err) {
    logger.error(`getAllVolunteers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const deleteVolunteers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      sendResponse(res, 422, 'Volunteer IDs are required');
      return;
    }

    await Auth.destroy({
      where: {
        id: ids,
        type: 'volunteer' // Extra safety: only delete volunteers
      }
    });

    res.status(200).json({
      status: true,
      message: 'Volunteers deleted successfully'
    });
    return;
  } catch (err) {
    logger.error(`deleteVolunteers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const bulkAddMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendResponse(res, 422, 'CSV file is required');
      return;
    }

    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    const results: any[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let failCount = 0;

    const expectedHeaders = [
      'firstName',
      'lastName',
      'email',
      'mobile',
      'subscriptionPlan',
      'paymentMethod',
      'transactionId',
      'startDate',
      'endDate'
    ];

    const ext = path.extname(req.file!.originalname).toLowerCase();

    if (ext === '.xlsx') {
      try {
        const workbook = XLSX.read(req.file!.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Get headers from first row
        const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) || [];

        // Validate Headers
        if (headers.length < 2 && expectedHeaders.length > 2) {
           sendResponse(res, 400, 'Invalid Excel format. headers not found.');
           return;
        }

        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          sendResponse(res, 400, `Missing required columns: ${missingHeaders.join(', ')}`);
          return;
        }

        // Parse data
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        // Map to match existing structure if needed, or expected keys matches functionality
        // sheet_to_json uses headers as keys, so if headers match expectedHeaders, results will have correct keys.
        results.push(...jsonData);

      } catch (xlsxError: any) {
        sendResponse(res, 400, 'Failed to parse Excel file');
        return;
      }
    } else {
      // CSV Parsing
      try {
        await new Promise((resolve, reject) => {
          const stream = Readable.from(req.file!.buffer.toString());
          const parser = csv();
          
          let headerCheckDone = false;
  
          stream
            .pipe(parser)
            .on('headers', (headers: string[]) => {
              headerCheckDone = true;
              
              if (headers.length < 2 && expectedHeaders.length > 2) {
                 reject(new Error('Invalid CSV format or wrong delimiter. Could not parse headers.'));
                 stream.destroy(); 
                 return;
              }
  
              const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
              if (missingHeaders.length > 0) {
                reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
                stream.destroy();
                return;
              }
            })
            .on('data', (row: any) => results.push(row))
            .on('end', resolve)
            .on('error', (err: any) => {
               reject(err);
            });
            
            stream.on('error', (err: any) => {
               // handled by reject above or ignored if already destroyed
            });
        });
      } catch (parseError: any) {
        sendResponse(res, 400, parseError.message || 'Failed to parse CSV file');
        return;
      }
    }

    logger.info(`Processing ${results.length} rows from CSV`);

    // Process each row
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        const {
          firstName,
          lastName,
          email,
          mobile,
          subscriptionPlan,
          paymentMethod,
          transactionId,
          startDate,
          endDate
        } = row;

        // Validate required fields
        if (!firstName || !lastName || !email || !mobile || !subscriptionPlan || !paymentMethod || !transactionId || !startDate) {
          errors.push({
            row: rowNumber,
            email: email || 'N/A',
            error: 'Missing required fields'
          });
          failCount++;
          continue;
        }

        // Check if user already exists
        const existingUser = await Auth.findOne({ where: { email } });
        if (existingUser) {
          errors.push({
            row: rowNumber,
            email,
            error: 'Email already exists'
          });
          failCount++;
          continue;
        }

        // Lookup membership plan
        const plan = await MembershipPlan.findOne({
          where: { duration: subscriptionPlan }
        });

        if (!plan) {
          errors.push({
            row: rowNumber,
            email,
            error: `Invalid subscription plan: ${subscriptionPlan}`
          });
          failCount++;
          continue;
        }

        // Generate random password
        const password = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Parse dates
        const membershipStartDate = new Date(startDate);
        let membershipEndDate: Date | null = null;

        if (subscriptionPlan.toLowerCase() === 'lifetime') {
          if (endDate) {
            membershipEndDate = new Date(endDate);
          } else {
            membershipEndDate = new Date(membershipStartDate);
            membershipEndDate.setFullYear(membershipEndDate.getFullYear() + 100);
          }
        } else {
           // Calculate based on plan duration
           let yearsToAdd = 1;
           const planLower = subscriptionPlan.toLowerCase();
           if (planLower.includes('one')) yearsToAdd = 1;
           else if (planLower.includes('two')) yearsToAdd = 2;

           membershipEndDate = new Date(membershipStartDate);
           membershipEndDate.setFullYear(membershipEndDate.getFullYear() + (yearsToAdd - 1));
           membershipEndDate.setMonth(11);
           membershipEndDate.setDate(31);
        }

        // Create member
        const newMember = await Auth.create({
          firstname: firstName,
          lastname: lastName,
          email,
          mobile,
          password: hashedPassword,
          type: 'member',
          confirm: true,
          membershipStatus: 'active',
          membershipStartDate,
          membershipEndDate,
          membershipPlanId: plan.id,
          paymentinformation: paymentMethod,
          isProfileComplete: true,
          authProvider: 'local',
          state: '',
          city: '',
          country: '',
          zipcode: '',
          address: '',
          address2: ''
        } as any);

        // Create payment record
        await Payment.create({
          userId: newMember.id,
          membershipPlanId: plan.id,
          amount: plan.amount,
          currency: 'USD',
          paymentMethod,
          paypalTransactionId: transactionId,
          paymentStatus: 'COMPLETED',
        });

        // Send welcome email (don't block on email failures)
        try {
          const emailHtml = welcomeEmailTemplate(email, password);
          await sendCustomMail(email, 'Welcome to Telugu Association', emailHtml);
        } catch (emailError) {
          logger.error(`Failed to send email to ${email}:`, emailError);
        }

        successCount++;
      } catch (rowError: any) {
        logger.error(`Error processing row ${rowNumber}:`, rowError);
        errors.push({
          row: rowNumber,
          email: row.email || 'N/A',
          error: rowError.message || 'Unknown error'
        });
        failCount++;
      }
    }

    res.status(200).json({
      status: true,
      message: 'Bulk upload completed',
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      },
      errors: errors.length > 0 ? errors : undefined
    });
    return;
  } catch (err) {
    logger.error(`bulkAddMembers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};

export const bulkAddVolunteers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendResponse(res, 422, 'CSV file is required');
      return;
    }

    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    const results: any[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let failCount = 0;

    const expectedHeaders = [
      'firstName',
      'lastName',
      'email',
      'mobile',
      'hoursPerMonth'
    ];

    const ext = path.extname(req.file!.originalname).toLowerCase();

    if (ext === '.xlsx') {
      try {
        const workbook = XLSX.read(req.file!.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Get headers from first row
        const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) || [];

        // Validate Headers
        if (headers.length < 2 && expectedHeaders.length > 2) {
           sendResponse(res, 400, 'Invalid Excel format. headers not found.');
           return;
        }

        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          sendResponse(res, 400, `Missing required columns: ${missingHeaders.join(', ')}`);
          return;
        }

        // Parse data
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        results.push(...jsonData);

      } catch (xlsxError: any) {
        sendResponse(res, 400, 'Failed to parse Excel file');
        return;
      }
    } else {
      // CSV Parsing
      try {
        await new Promise((resolve, reject) => {
          const stream = Readable.from(req.file!.buffer.toString());
          const parser = csv();
          
          let headerCheckDone = false;
  
          stream
            .pipe(parser)
            .on('headers', (headers: string[]) => {
              headerCheckDone = true;
              
              if (headers.length < 2 && expectedHeaders.length > 2) {
                 reject(new Error('Invalid CSV format or wrong delimiter. Could not parse headers.'));
                 stream.destroy(); 
                 return;
              }
  
              const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
              if (missingHeaders.length > 0) {
                reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
                stream.destroy();
                return;
              }
            })
            .on('data', (row: any) => results.push(row))
            .on('end', resolve)
            .on('error', (err: any) => {
               reject(err);
            });
            
            stream.on('error', (err: any) => {
               // handled by reject above or ignored if already destroyed
            });
        });
      } catch (parseError: any) {
        sendResponse(res, 400, parseError.message || 'Failed to parse CSV file');
        return;
      }
    }

    logger.info(`Processing ${results.length} volunteer rows from CSV`);

    // Process each row
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNumber = i + 2;

      try {
        const { firstName, lastName, email, mobile, hoursPerMonth } = row;

        if (!firstName || !lastName || !email || !mobile) {
          errors.push({
            row: rowNumber,
            email: email || 'N/A',
            error: 'Missing required fields'
          });
          failCount++;
          continue;
        }

        const existingUser = await Auth.findOne({ where: { email } });
        if (existingUser) {
          errors.push({
            row: rowNumber,
            email,
            error: 'Email already exists'
          });
          failCount++;
          continue;
        }

        const password = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newVolunteer = await Auth.create({
          firstname: firstName,
          lastname: lastName,
          email,
          mobile,
          password: hashedPassword,
          type: 'volunteer',
          confirm: true,
          membershipStatus: 'inactive',
          volunteerStatus: 'active',
          isProfileComplete: true,
          authProvider: 'local',
          volunteerHours: hoursPerMonth || '',
          paymentinformation: '',
          state: '',
          city: '',
          country: '',
          zipcode: '',
          address: '',
          address2: ''
        } as any);

        try {
          const emailHtml = welcomeEmailTemplate(email, password);
          await sendCustomMail(email, 'Welcome to Telugu Association - Volunteer Account Created', emailHtml);
        } catch (emailError) {
          logger.error(`Failed to send email to ${email}:`, emailError);
        }

        successCount++;
      } catch (rowError: any) {
        logger.error(`Error processing volunteer row ${rowNumber}:`, rowError);
        errors.push({
          row: rowNumber,
          email: row.email || 'N/A',
          error: rowError.message || 'Unknown error'
        });
        failCount++;
      }
    }

    res.status(200).json({
      status: true,
      message: 'Bulk volunteer upload completed',
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      },
      errors: errors.length > 0 ? errors : undefined
    });
    return;
  } catch (err) {
    logger.error(`bulkAddVolunteers error: ${err instanceof Error ? err.message : 'Unknown error'}`, { error: err });
    next(err);
  }
};


