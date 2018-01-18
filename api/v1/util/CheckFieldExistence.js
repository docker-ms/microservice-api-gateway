'use strict';

const CommonImport = require('../../../util/CommonImport');

class CheckFieldExistence {

  static get apiType() {
    return 'POST';
  }

  static checkFieldExistence(req, res, next) {

    const utilGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.util]);

    utilGrpcClient.checkFieldExistenceV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = CheckFieldExistence;


