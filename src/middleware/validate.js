const { ValidationError } = require('../utils/errors');

/**
 * Validation Middleware Factory
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(new ValidationError(message));
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

module.exports = validate;
