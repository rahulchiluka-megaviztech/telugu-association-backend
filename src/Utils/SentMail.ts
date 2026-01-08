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

// Create a persistent transporter with pooling and debugging
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true, // Keep connection open
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_EMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  debug: true, // Show SMTP traffic in logs
  logger: true, // Log to console
  connectionTimeout: 20000, // 20 seconds
  socketTimeout: 20000,
});

export const sendMail = async (emailId: string, otp: string | number) => {
  try {
    const accessToken = await oauth2Client.getAccessToken();
    
    const mailOptions = {
      from: process.env.GMAIL_EMAIL_USER,
      to: emailId,
      subject: 'Your OTP Code',
      html: emailTemplate(otp),
      auth: {
        accessToken: accessToken.token || '',
      }
    };

    const response = await transporter.sendMail(mailOptions);
    return response;
  } catch (error) {
    logger.error('Error sending email:', error);
    return error;
  }
};

export const sendCustomMail = async (to: string, subject: string, html: string) => {
  try {
    const accessToken = await oauth2Client.getAccessToken();

    const mailOptions = {
      from: process.env.GMAIL_EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
      auth: {
        accessToken: accessToken.token || '',
      }
    };

    const response = await transporter.sendMail(mailOptions);
    return response;
  } catch (error) {
    logger.error('Error sending custom email:', error);
    return error;
  }
};
