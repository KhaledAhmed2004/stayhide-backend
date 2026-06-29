import {
  ZodError,
  ZodIssueCode,
  ZodInvalidTypeIssue,
  ZodUnrecognizedKeysIssue,
} from 'zod';
import { IErrorMessage } from '../types/errors.types';
import { closest } from 'fastest-levenshtein';

// Clean the path (always returns string)
const cleanPath = (pathArray: (string | number)[]): string =>
  pathArray.join('.').replace(/^body\./, '');

const handleZodError = (
  error: ZodError,
): { statusCode: number; message: string; errorMessages: IErrorMessage[] } => {
  const allErrorMessages: IErrorMessage[] = [];
  const missingFields: string[] = [];
  const coveredFields: string[] = [];

  // Collect expected fields for suggestions
  const expectedFields = Array.from(
    new Set(
      error.errors
        .flatMap(issue =>
          issue.code === ZodIssueCode.invalid_type && issue.path.length > 1
            ? [String(issue.path[1])]
            : [],
        )
        .filter(Boolean),
    ),
  );

  // Single pass over all Zod issues
  error.errors.forEach(issue => {
    switch (issue.code) {
      case ZodIssueCode.unrecognized_keys: {
        const unrec = issue as ZodUnrecognizedKeysIssue;
        (unrec.keys || []).forEach(key => {
          const cleanKey = key.replace(/^body\./, '');
          const suggestion = closest(cleanKey, expectedFields);
          if (suggestion) coveredFields.push(suggestion);
          allErrorMessages.push({
            path: cleanKey,
            message: suggestion
              ? `We don't recognize '${cleanKey}'. Did you mean '${suggestion}'?`
              : `We don't recognize '${cleanKey}'.`,
          });
        });
        break;
      }

      case ZodIssueCode.invalid_type: {
        const invalid = issue as ZodInvalidTypeIssue;
        const path = cleanPath(invalid.path);

        if (invalid.received === 'undefined') {
          // Missing field
          missingFields.push(path);
        } else {
          // Type mismatch
          allErrorMessages.push({
            path,
            message: `Expected ${invalid.expected} for '${path}', but received ${invalid.received}.`,
          });
        }
        break;
      }

      default:
        allErrorMessages.push({
          path: cleanPath(issue.path) || 'unknown',
          message: issue.message,
        });
        break;
    }
  });

  // Add missing fields that are not covered by typo suggestions
  missingFields.forEach(field => {
    if (!coveredFields.includes(field)) {
      allErrorMessages.push({
        path: field,
        message: `Missing required field '${field}'.`,
      });
    }
  });

  return {
    statusCode: 400,
    message: 'Validation Error',
    errorMessages: allErrorMessages,
  };
};

export default handleZodError;
