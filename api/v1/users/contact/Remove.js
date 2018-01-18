'use strict';

const CommonImport = require('../../../../util/CommonImport');

class Remove {

  static get apiType() {
    return 'POST';
  }

  static remove(req, res, next) {

    req.body.initiatorUserId = req.user.uid;

    const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);

    usersGrpcClient.removeContactV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Remove;


