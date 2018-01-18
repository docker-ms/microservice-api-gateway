'use strict';

const CommonImport = require('../../../../util/CommonImport');

class Confirm {

  static get apiType() {
    return 'POST';
  }

  static confirm(req, res, next) {

    req.body.acceptorUserId = req.user.uid;

    const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);

    usersGrpcClient.confirmAddingContactV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Confirm;


