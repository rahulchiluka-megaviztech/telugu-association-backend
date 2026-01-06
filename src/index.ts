// import express,{NextFunction, Request,Response} from 'express'
// import cors from 'cors'
// import helmet from "helmet";
// import dotenv from 'dotenv'
// import { connectDb } from './connect/db';
// import MainRoute from './routes/main';
// import rateLimit from 'express-rate-limit';
// import logger from './Utils/Wiston';
// import { mongoSanitizerMiddleware } from './Utils/mongoSanitizer';
// const app=express()
// dotenv.config()
// const PORT=process.env.PORT || 8080
// const URL=process.env.MONGO_URL || ''
// app.use(cors())
// app.use(helmet())
// app.use(express.urlencoded({extended:true}))
// app.use(express.json())
// app.use(mongoSanitizerMiddleware);
// export const limiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 200,
//   message: {
//     success: false,
//     statusCode: 429,
//     message: "Too many requests. Please wait a minute and try again.",
//   },
//   standardHeaders: true,  
//   legacyHeaders: false,    
// })
// app.use('/api',MainRoute)
// app.use((req:Request,res:Response)=>{
//     res.status(404).json({status:false,message:'Page not found'})
//     return;
// })
// app.use((err:{status:number,errors:string,message:string,stack:string}, req: Request, res: Response, next: NextFunction) => {
//     const statusCode = err.status || 500;
//     const message = err.message || 'Internal server error';

//     res.status(statusCode).json({
//       success: false,
//       status: statusCode,
//       message: message,
//       errors: err.errors || null,
//       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//     });
//     return
//   });

// /
// (async () => {
//   try {
//     await sequelize.sync(); /
//     console.log('✅ Models synced');

//     app.listen(process.env.PORT || 5000, () => {
//       console.log('Server running on port', process.env.PORT || 5000);
//     });
//   } catch (error) {
//     console.error('Server start failed:', error);
//   }
// })();

import dotenv from 'dotenv'
dotenv.config();

import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from "helmet";
import rateLimit from 'express-rate-limit';
import logger from './Utils/Wiston';
import { mongoSanitizerMiddleware } from './Utils/mongoSanitizer';

import { sequelize, initializeModels } from './connect/db';
import MainRoute from './routes/main';


const app = express();
app.set('trust proxy', 1); // Trust first proxy (ngrok/vercel)
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(mongoSanitizerMiddleware);


const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many requests. Please wait a minute and try again.",
  },
});
app.use(limiter);

import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

app.use('/api', MainRoute);

app.use((req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  res.status(404).json({ status: false, message: 'Page not found' });
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;

  // Log error with full details
  if (statusCode >= 500) {
    logger.error(`Server Error [${statusCode}]: ${err.message} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`, {
      stack: err.stack,
      errors: err.errors
    });
  } else {
    logger.warn(`Client Error [${statusCode}]: ${err.message} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: err.message || 'Internal server error',
    errors: err.errors || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

(async () => {
  try {
    logger.info('='.repeat(50));
    logger.info('Starting Telugu Association Backend Server...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Port: ${PORT}`);

    // Initialize all models first
    initializeModels();

    // Then authenticate database connection
    await sequelize.authenticate();
    logger.info(`Database connected: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);

    // Sync models with database
    await sequelize.sync({ alter: false });
    logger.info('Database models synced successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info('='.repeat(50));
    });

  } catch (error) {
    logger.error('Server start failed:', error);
    process.exit(1);
  }
})();
