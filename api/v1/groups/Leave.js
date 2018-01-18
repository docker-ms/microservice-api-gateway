'use strict';

const CommonImport = require('../../../util/CommonImport');

class Leave {

  static get apiType() {
    return 'POST';
  }

  static leave(req, res, next) {

    if (req.body.targetUserUserIds && req.body.targetUserUserIds.length > 0) {
      // Kick.
      // Need to perform permissions check, return 'InvalidRequest' error for now.
      return next(new CommonImport.errors.UncategorizedError.InvalidRequest());
    }

    req.body.initiatorUserId = req.user.uid;
    req.body.targetUserUserIds = [req.user.uid];

    const groupsGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.groups]);

    groupsGrpcClient.leaveGroupV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Leave;


