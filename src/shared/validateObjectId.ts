import { isValidObjectId } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../errors/ApiError';

/**
 * Throws a 400 ApiError if `id` is not a valid MongoDB ObjectId.
 * Use this at the top of any service function that receives an id parameter
 * to prevent raw Mongoose CastErrors from leaking into the error handler.
 *
 * @param id    - The string to validate
 * @param label - Human-readable label used in the error message (default: 'ID')
 *
 * @example
 * validateObjectId(questionId, 'question ID');
 */
export const validateObjectId = (id: string, label = 'ID'): void => {
  if (!isValidObjectId(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid ${label}`);
  }
};
