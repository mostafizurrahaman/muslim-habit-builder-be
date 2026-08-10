import mongoose from 'mongoose';
import { ZodError } from 'zod';

export const handleMongooseError = (err: mongoose.Error.ValidationError) => {
  const errors: Record<string, string> = {};
  Object.values(err.errors).forEach((error) => {
    if (error.path && error.message) {
      errors[error.path] = error.message;
    }
  });
  return {
    statusCode: 400,
    message: 'Mongoose validation error',
    success: false,
    status: 'failed',
    errors,
  };
};

export const handleZodError = (err: ZodError) => {
  const errors: Record<string, string> = {};

  err.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
 const firstErrorMessage = err.issues[0]?.message || 'Invalid input data provided.';
  return {
    statusCode: 400,
    message: firstErrorMessage,
    success: false,
    status: 'failed',
    errors,
  };
};


export const handleCastError = (err: mongoose.Error.CastError) => {
  const errors: Record<string, string> = {};

  if (err.path && err.message) {
    errors[err.path] = err.message;
  }

  return {
    statusCode: 400,
    message: 'Invalid MongoDB ObjectId',
    success: false,
    status: 'failed',
    errors,
  };
};

export const handleDuplicateError = (err: any) => {
  const errors: Record<string, string> = {};

  if (err.keyValue) {
    Object.entries(err.keyValue).forEach(([key, value]) => {
      errors[key] = `${value} already exists`;
    });
  }

  return {
    statusCode: 400,
    message: 'Duplicate key error',
    success: false,
    status: 'failed',
    errors,
  };
};
