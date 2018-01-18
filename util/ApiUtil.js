'use strict';

const CommonImport = require('./CommonImport');

const enums = require('microservice-protos').enums;

class ApiUtil {

  static verifyAndNormalizeGender(gender, lang) {
    if (!CommonImport.utils.verifyAndNormalizeStr(gender)) {
      return false;
    }
    const val = enums.genders.exposedAs[lang][gender];
    if (val) {
      return val
    }
    return false;
  }

  static getEnterpriseUserBatchRegistDataFromCsv(req, next) {

    const dataCsvStr = req.file.buffer.toString()
                          .replace(/\r\n/g, '\n')
                          .replace(/\n,*\n/g, '')
                          .replace(/\n\t*\n/g, '')
                          .replace(/\t/g, ',');

    const regExp = /\*{5}(.*)\*{5}|-{5}.*-{5}(?:\n*.*\n)((?:.*\n*)*)$/gm;
    
    let lang;
    let companyId;
    let usersCsvStr;

    let match;
    let ctrl = 0;
    while (ctrl < 3) {
      match = regExp.exec(dataCsvStr);
      if (match) {
        switch (ctrl) {
          case 0:
            companyId = match[1];
            break;
          case 1:
            lang = match[1];
            break;
          case 2:
            usersCsvStr = match[2];
            break;
        }
      }
      ctrl++;
    }

    if (req.body.lang) {
      lang = req.body.lang;
    } else {
      Object.keys(CommonImport.i18n.maps).every((key) => {
        if (lang === CommonImport.i18n.maps[key]) {
          lang = key;
          return false;
        }
      });
    }

    companyId = req.body.companyId || companyId;

    /*
     * 'companyId' is required.
     */
    if (!companyId) {
      return next(new CommonImport.errors.InvalidField.InvalidCompanyId());
    }

    /*
     * No users data found.
     */
    if (!CommonImport.utils.verifyAndNormalizeStr(usersCsvStr)) {
      return next(new CommonImport.errors.UncategorizedError.NoDataFound());
    }

    const validUsers = [];

    const tmpEmails = [];
    const tmpMobilePhoneNos = [];

    const usersArr = usersCsvStr.split('\n');
    for (let i = 0; i < usersArr.length; i++) {
      let userFields = usersArr[i].split(',');

      let hasValidRealName = CommonImport.utils.verifyAndNormalizeStr(userFields[0]);
      if (!hasValidRealName) {
        return next(new CommonImport.errors.BusinessLogic.RealNameIsRequired());
      }
      let user = {realName: hasValidRealName};

      if (CommonImport.utils.verifyAndNormalizeStr(userFields[1])) {
        const hasValidGender = this.verifyAndNormalizeGender(userFields[1], lang);
        if (hasValidGender) {
          user.gender = hasValidGender;
        } else {
          return next(new CommonImport.errors.InvalidField.InvalidGender());
        }
      }

      let hasValidEmail = CommonImport.utils.verifyAndNormalizeEmail(userFields[2]);

      if (CommonImport.utils.verifyAndNormalizeStr(userFields[3]) && !userFields[3].startsWith('+')) {
        userFields[3] = '+' + userFields[3];
      }
      // Remove all '-'
      userFields[3] = userFields[3].replace(/-/g, '');
      let hasValidMobilePhoneNo = CommonImport.utils.verifyAndNormalizeMobilePhoneNo(userFields[3]);
      if (!hasValidEmail && !hasValidMobilePhoneNo) {
        return next(new CommonImport.errors.BusinessLogic.EmailOrMobilePhoneNoIsRequired());
      }

      if (hasValidEmail) {
        if (tmpEmails.indexOf(hasValidEmail) !== -1) {
          return next(new CommonImport.errors.UniqueRestriction.DuplicateEmail());
        }
        tmpEmails.push(hasValidEmail);
        user.email = hasValidEmail;
      }

      if (hasValidMobilePhoneNo) {
        if (tmpMobilePhoneNos.indexOf(hasValidMobilePhoneNo.mobilePhoneNoWithCountryCallingCode) !== -1) {
          return next(new CommonImport.errors.UniqueRestriction.DuplicateMobilePhoneNo());
        }
        tmpMobilePhoneNos.push(hasValidMobilePhoneNo.mobilePhoneNoWithCountryCallingCode);
        user.mobilePhone = hasValidMobilePhoneNo;
      }
      
      validUsers.push(user);
    }

    return {
      lang: lang,
      companyId: companyId,
      validUsers: validUsers
    };

  }

}

module.exports = ApiUtil;


