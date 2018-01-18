'use strict';

const CommonImport = require('./CommonImport');

const enums = require('microservice-protos').enums;

const ApiUtil = require('./ApiUtil');

module.exports = (req, res, next) => {

  /*
   * Rules for this common check stack.
   *   1. Don't check any business logic related restrictions.
   *   2. Don't check any mandatory restrictions.
   */

  // Do the cleanup.
  CommonImport.utils.cleanup(req.body);
  CommonImport.utils.cleanup(req.params);
  CommonImport.utils.cleanup(req.query);

  // Set 'requestId' to 'res.statusMessage' if client passed in.
  if (req.body.requestId) {
    res.statusMessage = req.body.requestId;
    req.body = CommonImport.utils.copyWithoutProperties(req.body, ['requestId']);
  }

  if (req.body.email) {
    const hasValidEmail = CommonImport.utils.verifyAndNormalizeEmail(req.body.email);
    if (hasValidEmail) {
      req.body.email = hasValidEmail;
    } else {
      return next(new CommonImport.errors.InvalidField.InvalidEmail());
    }
  }

  if (req.body.mobilePhone) {
    const hasValidMobilePhoneNo = CommonImport.utils.verifyAndNormalizeMobilePhoneNo(
      req.body.mobilePhone.mobilePhoneNoWithCountryCallingCode,
      req.body.mobilePhone.alpha3CountryCode
    );
    if (hasValidMobilePhoneNo) {
      req.body.mobilePhone = hasValidMobilePhoneNo;
    } else {
      return next(new CommonImport.errors.InvalidField.InvalidMobilePhoneNo());
    }
  }

  if (req.body.gender) {
    const hasValidGender = ApiUtil.verifyAndNormalizeGender(req.body.gender, req.body.lang);
    if (hasValidGender) {
      req.body.gender = hasValidGender;
    } else {
      return next(new CommonImport.errors.InvalidField.InvalidGender());
    }
  }

  // Let the request continue.
  next();

};


