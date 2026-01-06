import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Volunteer schema
const volunteerSchema = Joi.object({
  type: Joi.string().valid('volunteer').required(),
  firstname: Joi.string().min(3).required(),
  lastname: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
    }),
    confirmpassword: Joi.any().valid(Joi.ref('password')).optional().messages({
        'any.only': 'Confirm password must match password',
      }),
});

// Member schema
const memberSchema = Joi.object({
  type: Joi.string().valid('member').required(),
  firstname: Joi.string().min(3).required(),
  lastname: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
    }),
    confirmpassword: Joi.any().valid(Joi.ref('password')).optional().messages({
        'any.only': 'Confirm password must match password',
      }),
  state: Joi.string().required(),
  city: Joi.string().required(),
  country: Joi.string().required(),
  zipcode: Joi.string().required(),
  address: Joi.string().required(),
  address2: Joi.string().optional().allow(''),
  membershiptype: Joi.string().required(),
  paymentinformation: Joi.string().required(),
});

// Middleware
export const validateUser = (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.body;
  
    let schema;
  
    if (type === 'member' || type==="admin") {
      schema = memberSchema;
    } else if (type === 'volunteer') {
      schema = volunteerSchema;
    } else {
      res.status(400).json({
        status: false,
        message: 'Invalid type. Must be either "member"  or "volunteer".',
      });
      return
    }
  
    const { error } = schema.validate(req.body, { abortEarly: false });
  
    if (error) {
      const formattedErrors = error.details.map(err => ({
        key: err.path[0],
        message: err.message.replace(/['"]/g, ''),
      }));
     
      res.status(422).json({
        status: false,
        message: 'Validation failed',
        errors: formattedErrors,
      });
      return 
    }
  
    next();
  };
  
