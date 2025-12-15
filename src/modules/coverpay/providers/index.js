/**
 * BNPL Provider Registry
 */
const KlarnaProvider = require('./klarna');
const AffirmProvider = require('./affirm');

module.exports = {
  KlarnaProvider,
  AffirmProvider
};
