'use strict';

const CommonImport = require('../../../util/CommonImport');

const ApiUtil = require('../../../util/ApiUtil');

class BatchRegist {

  static get apiType() {
    return 'MULTER';
  }

  static get multerOpts() {
    return {
      type: 'single',
      val: 'users',
      needToPersist: false,
      supportedMimetypes: [
        'text/csv',
        'text/tab-separated-values'
      ]
    };
  }

  static batchRegist(req, res, next) {

    // Temporary fix fro 'MULTER' style API.
    // Set 'requestId' to 'res.statusMessage' if client passed in.
    if (req.body.requestId) {
      res.statusMessage = req.body.requestId;
      req.body = CommonImport.utils.copyWithoutProperties(req.body, ['requestId']);
    }

    const enterpriseUserData = ApiUtil.getEnterpriseUserBatchRegistDataFromCsv(req, next);

    if (!enterpriseUserData) {
      return next();
    }

    const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);

    const call = usersGrpcClient.enterpriseUserStreamBatchRegistV1((err, data) => {
      if (err) {
        return next(err);
      }
      
      res.send({[`${data.key}`]: data[data.key]});
    });

    // Only serve automated testing purpose.
    const companyId = global.IS_PROD_MODE && req.body.companyId;

    const fragments = enterpriseUserData.validUsers.reduce((acc, curr) => {

      // Only serve automated testing purpose.
      if (req.body.tester) {
        curr.tester = req.body.tester;
      }

      if (CommonImport.sizeof(acc[acc.length - 1]) < CommonImport.protos.constants.bestFragmentSize) {
        acc[acc.length - 1].users.push(curr);
      } else {
        acc.push({
          lang: enterpriseUserData.lang,
          total: enterpriseUserData.validUsers.length,
          companyId: companyId || enterpriseUserData.companyId,
          users: [curr]
        });
      }

      return acc;
    }, [{
      lang: enterpriseUserData.lang,
      total: enterpriseUserData.validUsers.length,
      companyId: companyId || enterpriseUserData.companyId,
      users: []
    }]);

    const sendFragments = fragments.reduce((acc, curr) => {
      acc.push(call.write(curr));
      return acc;
    }, []);

    CommonImport.Promise.all(sendFragments).then(() => {
      call.end();
    }).catch((err) => {
      if (err) {
        return next(err);
      }
    });

  }

}

module.exports = BatchRegist;


