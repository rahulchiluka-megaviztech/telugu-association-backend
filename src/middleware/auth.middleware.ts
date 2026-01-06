import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Auth } from '../model/Auth';
import logger from '../Utils/Wiston';

// Extend Express Request type
export interface AuthRequest extends Request {
    user?: {
        id: number;
        type: 'member' | 'volunteer' | 'admin';
        IsAdmin: boolean;
    };
    authUser?: Auth; // Full user object from database
}

/**
 * Extract and verify JWT token
 * Attaches user to req.user and full user object to req.authUser
 */
export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn(`Authentication failed: No token provided - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please provide a valid token.'
            });
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, process.env.JWTKEY as string);

        if (typeof decoded !== 'object' || !('user' in decoded)) {
            logger.warn(`Authentication failed: Invalid token payload - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid token payload'
            });
        }

        // Fetch user from database (single query)
        const user = await Auth.findByPk(decoded.user.id);

        if (!user) {
            logger.warn(`Authentication failed: User not found (ID: ${decoded.user.id}) - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: 'User not found. Token may be invalid.'
            });
        }

        // Attach to request
        req.user = {
            id: user.id,
            type: user.type,
            IsAdmin: user.IsAdmin || false
        };
        req.authUser = user;

        logger.info(`Authentication successful: User ${user.id} (${user.type}) - ${req.method} ${req.originalUrl}`);
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            logger.error(`JWT verification failed: ${error.message} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        logger.error(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'} - ${req.method} ${req.originalUrl}`);
        next(error);
    }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that show different data for logged-in users
 */
export const optionalAuth = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(); // Continue without auth
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWTKEY as string);

        if (typeof decoded === 'object' && 'user' in decoded) {
            const user = await Auth.findByPk(decoded.user.id);
            if (user) {
                req.user = {
                    id: user.id,
                    type: user.type,
                    IsAdmin: user.IsAdmin || false
                };
                req.authUser = user;
                logger.info(`Optional auth: User ${user.id} authenticated - ${req.method} ${req.originalUrl}`);
            }
        }

        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        logger.debug(`Optional auth: Token verification failed, continuing without auth - ${req.method} ${req.originalUrl}`);
        next();
    }
};

/**
 * Require admin role
 * Must be used AFTER authenticate middleware
 */
export const requireAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.user || !req.user.IsAdmin) {
        logger.warn(`Authorization failed: Admin access denied for user ${req.user?.id || 'unknown'} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    logger.info(`Authorization successful: Admin user ${req.user.id} - ${req.method} ${req.originalUrl}`);
    next();
};

/**
 * Require specific role(s)
 * Must be used AFTER authenticate middleware
 */
export const requireRole = (...roles: Array<'member' | 'volunteer' | 'admin'>) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.type)) {
            logger.warn(`Authorization failed: Required role ${roles.join('/')} but user ${req.user?.id || 'unknown'} has role ${req.user?.type || 'none'} - ${req.method} ${req.originalUrl}`);
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }
        logger.info(`Authorization successful: User ${req.user.id} with role ${req.user.type} - ${req.method} ${req.originalUrl}`);
        next();
    };
};

/**
 * Require user to be accessing their own resource
 * Must be used AFTER authenticate middleware
 */
export const requireSelf = (paramName: string = 'id') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const resourceId = parseInt(req.params[paramName]);

        if (!req.user || req.user.id !== resourceId) {
            logger.warn(`Authorization failed: User ${req.user?.id || 'unknown'} attempted to access resource ${resourceId} - ${req.method} ${req.originalUrl}`);
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your own resources.'
            });
        }
        logger.info(`Authorization successful: User ${req.user.id} accessing own resource - ${req.method} ${req.originalUrl}`);
        next();
    };
};

/**
 * Require user to be admin OR accessing their own resource
 */
export const requireSelfOrAdmin = (paramName: string = 'id') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const resourceId = parseInt(req.params[paramName]);

        if (!req.user) {
            logger.warn(`Authorization failed: No user authenticated - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Allow if admin OR if accessing own resource
        if (req.user.IsAdmin || req.user.id === resourceId) {
            logger.info(`Authorization successful: User ${req.user.id} (${req.user.IsAdmin ? 'admin' : 'self'}) accessing resource ${resourceId} - ${req.method} ${req.originalUrl}`);
            return next();
        }

        logger.warn(`Authorization failed: User ${req.user.id} (non-admin) attempted to access resource ${resourceId} - ${req.method} ${req.originalUrl}`);
        return res.status(403).json({
            success: false,
            message: 'Access denied'
        });
    };
};
