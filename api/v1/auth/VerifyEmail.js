'use strict';

const CommonImport = require('../../../util/CommonImport');

class VerifyEmail {

  static get apiType() {
    return 'GET';
  }

  static verifyEmail(req, res, next) {

    const authGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.auth]);

    const decodedToken = CommonImport.jwt.decode(req.query.at);

    authGrpcClient.verifyEmailV1({
      lang: decodedToken.lang,
      email: decodedToken.email,
      [`${decodedToken.verificationType}`]: true
    }, (err, data) => {
      let imgIndicator = '/images/tick.png';
      let msg = CommonImport.i18n.i18nInternal.__({phrase: 'VerificationMsgs.Email.successfullyVerified', locale: decodedToken.lang});

      if (err) {
        imgIndicator = '/images/cross.png';
        msg = CommonImport.i18n.i18nInternal.__({
          phrase: (new (CommonImport.errors.lookup(err.message))()).i18nMsgCode,
          locale: decodedToken.lang
        });
      }

      res.write(`\
        <div style="position: relative; width: 100%; height: 64px; margin: 7% auto 0 auto; background: url(${imgIndicator}) no-repeat center center; background-size: 64px auto;"> \
          <div style="position: absolute; bottom: -29px; width:100%; text-align: center; font-size: 1.4em;">${msg}</div> \
        </div> \
      `);

      res.end();
    });

  }

}

module.exports = VerifyEmail;


