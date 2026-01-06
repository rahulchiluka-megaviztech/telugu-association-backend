import { Request, Response, NextFunction } from 'express';
import logger from './Wiston';

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const protocol = req.protocol
    const host = req.hostname || req.headers.host || 'Unknown Host'; 
    const logMessage = `Protocol:${protocol},Host:${host},Method:${req.method},EndPoint:${req.originalUrl},StausCode:${res.statusCode},Time:${duration}ms`;

    if (res.statusCode >= 400) {
      logger.warn(logMessage); 
    } else {
      logger.info(logMessage);
    }
  });

  next();
};

export default requestLogger;
