'use strict';

const CommonImport = require('../../../../util/CommonImport');

class Update {

  static get apiType() {
    return 'POST';
  }

  static get paramsTpl() {
    return '/:userId?';
  }

  static update(req, res, next) {

    if (req.params.userId && req.params.userId !== req.user.uid) {
      // Try to update someone else's profile, admin?
      // Need to perform permissions check here, return 'InvalidRequest' error first.
      return next(new CommonImport.errors.UncategorizedError.InvalidRequest());
    }

    req.body.userId = req.user.uid;

    const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);

    usersGrpcClient.updateProfileV1(req.body, (err, data) => {
      if (err) {
        return next(err);
      }

      res.send({[`${data.key}`]: data[data.key]});
    });

  }

}

module.exports = Update;


