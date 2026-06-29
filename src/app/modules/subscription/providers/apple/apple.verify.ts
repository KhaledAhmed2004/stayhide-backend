import httpStatus from 'http-status';
import ApiError from '../../../../../errors/ApiError';
import config from '../../../../../config';
import { getAppleVerifier } from './apple.client';
import {
  AppleEnvironment,
  DecodedAppleTransaction,
} from './apple.types';

const mapEnvironment = (raw: unknown): AppleEnvironment => {
  const value = String(raw || '').toLowerCase();
  return value.includes('prod') ? 'production' : 'sandbox';
};

export const verifyAppleTransaction = async (
  signedTransactionInfo: string
): Promise<DecodedAppleTransaction> => {
  if (!signedTransactionInfo || typeof signedTransactionInfo !== 'string') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'signedTransactionInfo is required and must be a string'
    );
  }

  const verifier = getAppleVerifier();

  let decoded;
  try {
    decoded = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Apple transaction verification failed: ${message}`
    );
  }

  // Apple types all fields as optional. Guard every required field.
  if (!decoded.transactionId || !decoded.originalTransactionId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Decoded Apple transaction is missing transaction IDs'
    );
  }

  if (!decoded.productId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Decoded Apple transaction is missing productId'
    );
  }

  if (!decoded.bundleId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Decoded Apple transaction is missing bundleId'
    );
  }

  if (decoded.bundleId !== config.apple.bundleId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Bundle ID mismatch: expected ${config.apple.bundleId}, received ${decoded.bundleId}`
    );
  }

  if (decoded.revocationDate) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Transaction has been revoked by Apple'
    );
  }

  if (decoded.expiresDate && Date.now() > decoded.expiresDate) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Transaction has already expired'
    );
  }

  return {
    transactionId: decoded.transactionId,
    originalTransactionId: decoded.originalTransactionId,
    productId: decoded.productId,
    bundleId: decoded.bundleId,
    purchaseDate: decoded.purchaseDate ?? Date.now(),
    expiresDate: decoded.expiresDate,
    revocationDate: decoded.revocationDate,
    revocationReason:
      typeof decoded.revocationReason === 'number'
        ? decoded.revocationReason
        : undefined,
    environment: mapEnvironment(decoded.environment),
    appAccountToken: decoded.appAccountToken,
    isUpgraded: decoded.isUpgraded,
  };
};
