'use strict';

const CommonImport = require('../../../util/CommonImport');

class Regist {

  static get apiType() {
    return 'PUT';
  }

  static regist(req, res, next) {

    /*
     * 'companyId' is required.
     */
    if (!req.body.companyId) {
      return next(new CommonImport.errors.InvalidField.InvalidCompanyId());
    }

    /*
     * 'email' or 'mobilePhone' must at least have one.
     */
    if (!req.body.email && !req.body.mobilePhone) {
      return next(new CommonImport.errors.BusinessLogic.EmailOrMobilePhoneNoIsRequired());
    }

    const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);

    usersGrpcClient.enterpriseUserSingleRegistV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Regist;


