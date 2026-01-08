import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { emailTemplate } from './EmailTemplate';
import dotenv from 'dotenv';
import logger from './Wiston';

dotenv.config(); 

const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

export const sendMail = async (emailId: string, otp: string | number) => {
  try {
    let accessToken;
    try {
      accessToken = await oauth2Client.getAccessToken();
    } catch (tokenError: any) {
      logger.error('Error fetching access token for OTP:', tokenError);
      throw new Error(`Failed to get access token: ${tokenError.message}`);
    }

    const smtpTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
      },
    });

    const mailOptions = {
      from: 'team@telugumn.org',
      to: emailId,
      subject: 'Your OTP Code',
      html: emailTemplate(otp),
      auth: {
        user: process.env.GMAIL_EMAIL_USER,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token || '',
      },
    };

    const response = await smtpTransport.sendMail(mailOptions);
    smtpTransport.close();
    return response
  } catch (error) {
    logger.error('Error sending email:', error)
    return error
  }
};

export const sendCustomMail = async (to: string, subject: string, html: string) => {
  try {
    let accessToken;
    try {
      accessToken = await oauth2Client.getAccessToken();
    } catch (tokenError: any) {
      logger.error('Error fetching access token:', tokenError);
      
      // DEBUG LOGGING: Verify credentials are loaded correctly
      logger.error(`Debug Credentials: ${JSON.stringify({
        clientId: process.env.GMAIL_CLIENT_ID ? process.env.GMAIL_CLIENT_ID.substring(0, 10) + '...' : 'undefined',
        hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN ? process.env.GMAIL_REFRESH_TOKEN.substring(0, 10) + '...' : 'undefined',
        user: process.env.GMAIL_EMAIL_USER
      })}`);

      if (tokenError.response && tokenError.response.data) {
        logger.error('Token error details:', tokenError.response.data);
      }
      throw new Error(`Failed to get access token: ${tokenError.message}`);
    }

    const smtpTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
      },
    });

    const mailOptions = {
      from: 'team@telugumn.org',
      to: to,
      subject: subject,
      html: html,
      auth: {
        user: process.env.GMAIL_EMAIL_USER,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token || '',
      },
    };

    const response = await smtpTransport.sendMail(mailOptions);
    smtpTransport.close();
    return response
  } catch (error) {
    logger.error('Error sending custom email:', error);
    return error;
  }
};
