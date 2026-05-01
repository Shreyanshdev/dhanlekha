/**
 * Base application error class.
 * All custom errors extend this.
 */
class AppError extends Error {
  public statusCode: number;
  public code: string;
  public field?: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — Malformed request, invalid input */
class ValidationError extends AppError {
  constructor(message: string, field: string | null = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

/** 401 — Missing or invalid auth token */
class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/** 403 — Insufficient role or plan quota exceeded */
class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — Resource not found */
class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/** 409 — Conflict (duplicate barcode, sync conflict) */
class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 — Business rule violation (credit limit, negative stock) */
class BusinessRuleError extends AppError {
  constructor(message: string, code: string = 'BUSINESS_RULE_VIOLATION') {
    super(message, 422, code);
  }
}

export {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
};
