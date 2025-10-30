const Joi = require('joi');

/**
 * KYC Validation Schemas
 */

const initiateKYCSchema = Joi.object({
  userId: Joi.string().required().description('User ID'),
  firstName: Joi.string().min(2).max(50).required().description('First name'),
  lastName: Joi.string().min(2).max(50).required().description('Last name'),
  email: Joi.string().email().required().description('Email address'),
  dateOfBirth: Joi.date().max('now').required().description('Date of birth'),
  nationality: Joi.string().length(2).required().description('Nationality (ISO 3166-1 alpha-2)'),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().length(2).required(),
  }).required().description('Address information'),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().description('Phone number'),
});

const submitDocumentsSchema = Joi.object({
  userId: Joi.string().required().description('User ID'),
  documents: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid('passport', 'drivers_license', 'national_id', 'proof_of_address')
          .required(),
        documentNumber: Joi.string().required(),
        expiryDate: Joi.date().greater('now').required(),
        frontImage: Joi.string().uri().required(),
        backImage: Joi.string().uri(),
      })
    )
    .min(1)
    .required()
    .description('KYC documents'),
});

const getKYCStatusSchema = Joi.object({
  userId: Joi.string().required().description('User ID'),
});

module.exports = {
  initiateKYCSchema,
  submitDocumentsSchema,
  getKYCStatusSchema,
};
