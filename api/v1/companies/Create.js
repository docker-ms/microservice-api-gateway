'use strict';

const CommonImport = require('../../../util/CommonImport');

class Create {

  static get apiType() {
    return 'POST';
  }

  static create(req, res, next) {

    if (!req.body.companyName) {
      return next(new CommonImport.errors.BusinessLogic.CompanyNameIsRequired());
    }

    /*
     * To company, email address is mandatory.
     */
    if (!req.body.email) {
      return next(new CommonImport.errors.BusinessLogic.EmailIsRequired());
    }
    
    req.body.setUpBy = req.user.bcode;

    const companiesGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.companies]);

    companiesGrpcClient.createCompanyV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Create;


