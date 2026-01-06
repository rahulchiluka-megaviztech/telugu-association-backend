
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Auth } from '../model/Auth';
import { Node_Type } from './Types';
const app = express();

export const Validate = async (req: Node_Type, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(400).json({ message: 'invalid token' });
            return;
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.substring(7);

        const decode = jwt.verify(token, process.env.JWTKEY as string);
        if (typeof decode === 'object' && 'user' in decode) {
            req.user = decode.user;
        } else {
            res.status(400).json({ message: 'Invalid token payload' });
            return;
        }
        const exist = await Auth.findByPk(req.user.id);
        if (!exist) {
            res.status(400).json({ message: 'Access denied' });
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};

export const Admin = async (req: Node_Type, res: Response, next: NextFunction) => {
    try {
        const user = await Auth.findByPk(req.user.id);
        if (!user || !user.IsAdmin) {
            res.status(403).json({ message: 'Access denied. Admin only.' });
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};