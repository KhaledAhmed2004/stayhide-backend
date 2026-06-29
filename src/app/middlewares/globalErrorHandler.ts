import { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../config';
import ApiError from '../../errors/ApiError';
import handleValidationError from '../../errors/handleValidationError';
import handleZodError from '../../errors/handleZodError';
import handleCastError from '../../errors/handleCastError';
import { errorLogger } from '../../shared/logger';
import { IErrorMessage } from '../../types/errors.types';
import { trace } from '@opentelemetry/api';

const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  // (disabled) redundant separate console log - now beautifully captured and handled by OTel & custom requestLogger

  // OpenTelemetry: start Error Handler span
  const tracer = trace.getTracer('app');
  const span = tracer.startSpan('Error Handler');
  try {
    span.setAttribute('layer', 'Middleware > Error');
    span.setAttribute('http.method', req.method);
    span.setAttribute(
      'http.route',
      (req.route && (req.route as any).path) || req.originalUrl || 'n/a',
    );
    span.addEvent('ERROR_HANDLER_START');
    // Record the incoming error for context but keep handler span non-error
    span.recordException(error as any);
    span.setStatus({ code: 1, message: 'Formatted error response' });

    let statusCode = 500;
    let message = 'Something went wrong';
    let errorMessages: IErrorMessage[] = [];

    if (error.name === 'ZodError') {
      const simplifiedError = handleZodError(error);
      statusCode = simplifiedError.statusCode;
      message = simplifiedError.message;
      errorMessages = simplifiedError.errorMessages;
    } else if (error.name === 'ValidationError') {
      const simplifiedError = handleValidationError(error);
      statusCode = simplifiedError.statusCode;
      message = simplifiedError.message;
      errorMessages = simplifiedError.errorMessages;
    } else if (error.name === 'CastError') {
      const simplifiedError = handleCastError(error);
      statusCode = simplifiedError.statusCode;
      message = simplifiedError.message;
      errorMessages = simplifiedError.errorMessages;
    } else if (
      error.name === 'MongoServerError' &&
      (error as any).code === 11000
    ) {
      statusCode = StatusCodes.CONFLICT;
      const duplicatedField = Object.keys((error as any).keyValue)[0];
      message = `${duplicatedField} already exists`;
      errorMessages = [
        { path: duplicatedField, message: `${duplicatedField} must be unique` },
      ];
    } else if (error.name === 'TokenExpiredError') {
      statusCode = StatusCodes.UNAUTHORIZED;
      message = 'Session Expired';
      errorMessages = [
        {
          path: '',
          message: 'Your session has expired. Please log in again to continue.',
        },
      ];
    } else if (
      error instanceof Error &&
      error.message === 'Not allowed by CORS'
    ) {
      statusCode = StatusCodes.FORBIDDEN;
      const origin = String(req.headers.origin || 'undefined');
      message = 'CORS blocked: origin not allowed';
      errorMessages = [
        {
          path: 'Origin',
          message: `'${origin}' is not permitted by CORS policy. Add it to allowed origins or ensure the request includes the correct Origin header.`,
        },
      ];
      try {
        res.setHeader('X-CORS-Blocked', '1');
        res.setHeader('Vary', 'Origin');
      } catch {}
    } else if (error instanceof ApiError) {
      statusCode = error.statusCode;
      message = error.message;
      errorMessages = error.message
        ? [{ path: '', message: error.message }]
        : [];
    } else if (error instanceof Error) {
      message = error.message;
      errorMessages = error.message
        ? [{ path: '', message: error.message }]
        : [];
    }

    res.locals.errorHandledBy = 'globalErrorHandler';
    res.locals.responsePayload = {
      success: false,
      statusCode,
      message,
      errorMessages,
    };

    res.status(statusCode).json({
      success: false,
      message,
      errorMessages,
      stack: config.node_env !== 'production' ? error?.stack : undefined,
    });
  } finally {
    span.addEvent('FORMATTED_ERROR_RESPONSE');
    span.addEvent('ERROR_HANDLER_COMPLETE');
    span.end();
  }
};

export default globalErrorHandler;
