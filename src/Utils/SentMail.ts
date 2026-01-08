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

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Creates a base64url encoded MIME message
 */
const createMimeMessage = (to: string, from: string, subject: string, html: string) => {
  const str = [
    `Content-Type: text/html; charset="UTF-8"\n`,
    `MIME-Version: 1.0\n`,
    `Content-Transfer-Encoding: 7bit\n`,
    `to: ${to}\n`,
    `from: ${from}\n`,
    `subject: ${subject}\n\n`,
    html,
  ].join('');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const sendMail = async (emailId: string, otp: string | number) => {
  try {
    const from = process.env.GMAIL_EMAIL_USER || 'team@telugumn.org';
    const subject = 'Your OTP Code';
    const html = emailTemplate(otp);

    const raw = createMimeMessage(emailId, from, subject, html);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });

    return res.data;
  } catch (error) {
    logger.error('Error sending email via Gmail API:', error);
    return error;
  }
};

export const sendCustomMail = async (to: string, subject: string, html: string) => {
  try {
    const from = process.env.GMAIL_EMAIL_USER || 'team@telugumn.org';
    const raw = createMimeMessage(to, from, subject, html);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });

    return res.data;
  } catch (error) {
    logger.error('Error sending custom email via Gmail API:', error);
    return error;
  }
};
