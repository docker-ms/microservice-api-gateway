'use strict';

const CommonImport = require('../../../util/CommonImport');

class GenerateCsvTpl {

  static get apiType() {
    return 'GET';
  }

  static get paramsTpl() {
    return '/:lang/:tplId';
  }

  static generateCsvTpl(req, res, next) {

    if (!req.params.tplId) {
      return next(new CommonImport.errors.InvalidField.InvalidCsvTplId());
    }

    if (!req.query.companyId) {
      return next(new CommonImport.errors.InvalidField.InvalidCompanyId());
    }

    const utilGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.util]);

    utilGrpcClient.generateCsvTplV1({
      tplId: req.params.tplId,
      lang: req.params.lang,
      enterpriseUserBatchRegistCsvTplParams: {
        companyId: req.query.companyId
      }
    }, (err, data) => {
      if (err) {
        return next(err);
      }

      const filename = encodeURIComponent(data.filename);

      res.set({
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Content-type': 'text/csv'
      });

      res.send(data.csvStr);
    });

  }

}

module.exports = GenerateCsvTpl;


