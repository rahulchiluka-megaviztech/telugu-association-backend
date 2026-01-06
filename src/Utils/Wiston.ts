import winston from 'winston';

const transports: winston.transport[] = [];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/requests.log' }),
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error' })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports,
  silent: process.env.NODE_ENV === 'production',
});

export default logger;


