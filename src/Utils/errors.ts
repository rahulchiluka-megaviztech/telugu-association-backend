import { Response } from 'express';
export const sendResponse = (res: Response, statusCode: number, message: string) => {
res.status(statusCode).json({
    status: false,
    message,
  });
};
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
export const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;