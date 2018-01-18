'use strict';

const CommonImport = require('../../../util/CommonImport');

class Lsync {

  static get apiType() {
    return 'POST';
  }

  static lsync(req, res, next) {

    /********************************************************** Start: for zipkin. ********************************************************/
    const metadata = global.ZIPKIN_GRPC_INTCP.beforeClientDoGrpcCall({
      serviceName: process.env.MS_SERVICE_TAG,
      remoteGrpcServiceName: 'lsyncV1'
    });
    /*********************************************************** End: for zipkin. *********************************************************/

    const lsyncGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.lsync]);

    const lsyncReq = {
      userId: req.user.uid,
      deviceId: req.user.did,
      version: req.body.version,
      bucketId: req.body.bucketId
    };

    CommonImport.utils.cleanup(lsyncReq);

    const call = lsyncGrpcClient.lsyncV1(lsyncReq, metadata);

    call.on('data', (data) => {
      CommonImport.utils.cleanup(data);
      res.write(JSON.stringify(data));
    });

    call.on('status', (status) => {
      if (status.code === 0) {

        /********************************************************** Start: for zipkin. *******************************************************/
        global.ZIPKIN_GRPC_INTCP.afterGrpcCallFinish();
        /*********************************************************** End: for zipkin. ********************************************************/

        res.end();
      } else {
        next(new Error(status.details));
      }
    });

  }

}

module.exports = Lsync;


