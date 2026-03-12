const { BadRequestError } = require('../utils/errors');

/**
 * Middleware factory that validates request body against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @param {string} source - 'body' | 'query' | 'params'
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data; // Replace with parsed/coerced data
      next();
    } catch (error) {
      if (error.errors) {
        const messages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new BadRequestError(JSON.stringify(messages)));
      }
      next(error);
    }
  };
};

module.exports = { validate };
