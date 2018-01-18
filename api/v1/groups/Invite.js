'use strict';

const CommonImport = require('../../../util/CommonImport');

class Invite {

  static get apiType() {
    return 'POST';
  }

  static invite(req, res, next) {

    req.body.inviterUserId = req.user.uid;

    const groupsGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.groups]);

    groupsGrpcClient.inviteUserToGroupV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Invite;


