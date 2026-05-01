import { ValidationError } from '../utils/errors';

/**
 * Joi validation middleware factory.
 * Validates req.body against a Joi schema before the request reaches the controller.
 *
 * @param {import('joi').Schema} schema — Joi schema to validate against
 * @param {'body'|'query'|'params'} source — which part of the request to validate
 * @returns {Function} Express middleware
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      const field = error.details[0]?.path?.join('.') || null;
      return next(new ValidationError(message, field));
    }

    // Replace with validated + sanitised values
    req[source] = value;
    next();
  };
}

export default validate;
