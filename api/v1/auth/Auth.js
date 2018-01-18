'use strict';

const CommonImport = require('../../../util/CommonImport');

class Auth {

  static get apiType() {
    return 'POST';
  }

  static auth(req, res, next) {
    
    global.logger.debug('Someone is trying to sign in: ', Object.assign({aux: [req.body]}, global.logMetaData));

    const cookieBaseOpts = {
      path: '/',
      secure: true,
      httpOnly: true,
    };

    if (req.body.branchCode) {

      const _checkBranchCredential = () => {
        const reqBody = {
          lang: req.body.lang,
          branchCode: req.body.branchCode,
          pwd: req.body.pwd,
          deviceId: req.body.deviceId
        };

        CommonImport.utils.cleanup(reqBody);

        const authGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.auth]);

        authGrpcClient.signInV1(reqBody, (err, data) => {
          if (err) {
            return next(err);
          }

          const decodedSetupToken = CommonImport.jwt.decode(data.accessToken);

          res.cookie(
            'accessToken',
            data.accessToken,
            Object.assign({}, cookieBaseOpts, {expires: new Date(decodedSetupToken.exp * 1000)})
          );

          res.json({
            success: true
          });
        });
      };

      if (req.cookies.accessToken) {
        CommonImport.Promise.promisify(CommonImport.jwt.verify)(
          req.cookies.accessToken,
          global.JWT_GATE_OPTS.strSecret,
          global.JWT_GATE_OPTS.token24Opts
        ).then((decodedSetupToken) => {
          if (decodedSetupToken.bcode && decodedSetupToken.bcode === req.body.branchCode) {
            res.json({
              success: true
            });
          } else {
            _checkBranchCredential();
          }
        }).catch((err) => {
          _checkBranchCredential();
        });
      } else {
        _checkBranchCredential();
      }
      
    } else {

      if (req.cookies.accessToken && req.cookies.refreshToken) {

        CommonImport.Promise.promisify(CommonImport.jwt.verify)(
          req.cookies.refreshToken,
          global.JWT_GATE_OPTS.strSecret,
          global.JWT_GATE_OPTS.refreshTokenOpts
        ).then((decodedRT) => {

          const decodedAT = CommonImport.jwt.decode(req.cookies.accessToken);

          let needToRegenAccessToken = false;
          if ((decodedAT.exp * 1000 - +new Date()) / 1000 / 60 < global.JWT_GATE_OPTS.tokenRegenThreshold.accessTokenInMins) {
            // This access token will be expired in less than '.tokenRegenThreshold.accessTokenInMins', so we regenerate a new one.
            needToRegenAccessToken = true
          }

          let needToRegenRefreshToken = false;
          if ((decodedRT.exp * 1000 - +new Date()) / 1000 / 60 / 60 / 24 < global.JWT_GATE_OPTS.tokenRegenThreshold.refreshTokenInDays) {
            // This refresh token will be expired in less than '.tokenRegenThreshold.refreshTokenInDays', so we regenerate a new one.
            needToRegenRefreshToken = true;
          }

          const sign = CommonImport.Promise.promisify(CommonImport.jwt.sign);

          const accessTokenPayload = {
            uid: decodedAT.uid,
            cid: decodedAT.cid,
            did: decodedAT.did,
            scp: decodedAT.scp
          };

          if (needToRegenAccessToken && needToRegenRefreshToken) {
            return CommonImport.Promise.join(
              sign(accessTokenPayload, global.JWT_GATE_OPTS.strSecret, Object.assign({}, global.JWT_GATE_OPTS.accessTokenOpts, {
                jwtid: decodedRT.jti
              })),
              sign({}, global.JWT_GATE_OPTS.strSecret, Object.assign({}, global.JWT_GATE_OPTS.refreshTokenOpts, {
                jwtid: decodedRT.jti
              })),
              (newAccessToken, newRefreshToken) => {
                const newDecodedRT = CommonImport.jwt.decode(newRefreshToken);
                const cookieOpts = Object.assign({}, cookieBaseOpts, {expires: new Date(newDecodedRT.exp * 1000)});

                res.cookie('accessToken', newAccessToken, cookieOpts);
                res.cookie('refreshToken', newRefreshToken, cookieOpts);

                res.json({
                  success: true
                });
              }
            );
          } else if (needToRegenAccessToken) {
            return sign(accessTokenPayload, global.JWT_GATE_OPTS.strSecret, Object.assign({}, global.JWT_GATE_OPTS.accessTokenOpts, {
              jwtid: decodedRT.jti
            })).then((newAccessToken) => {
              const cookieOpts = Object.assign({}, cookieBaseOpts, {expires: new Date(decodedRT.exp * 1000)});

              res.cookie('accessToken', newAccessToken, cookieOpts);

              res.json({
                success: true
              });
            });
          } else if (needToRegenRefreshToken) {
            return sign({}, global.JWT_GATE_OPTS.strSecret, Object.assign({}, global.JWT_GATE_OPTS.refreshTokenOpts, {
              jwtid: decodedRT.jti
            })).then((newRefreshToken) => {
              const decodedNewRefreshToken = CommonImport.jwt.decode(newRefreshToken);

              const cookieOpts = Object.assign({}, cookieBaseOpts, {expires: new Date(decodedNewRefreshToken.exp * 1000)});

              res.cookie('accessToken', req.cookies.accessToken, cookieOpts);
              res.cookie('refreshToken', newRefreshToken, cookieOpts);

              res.json({
                success: true
              });
            });
          } else {
            res.json({
              success: true
            });
          }

        }).catch((err) => {
          next(err);
        });

      } else if (req.body.pwd) {

        /********************************************************** Start: for zipkin. ********************************************************/
        const metadata = global.ZIPKIN_GRPC_INTCP.beforeClientDoGrpcCall({
          serviceName: process.env.MS_SERVICE_TAG,
          remoteGrpcServiceName: 'signInV1'
        });
        /*********************************************************** End: for zipkin. *********************************************************/

        const reqBody = {
          lang: req.body.lang,
          email: req.body.email,
          mobilePhone: req.body.mobilePhone,
          userSetId: req.body.userSetId,
          pwd: req.body.pwd,
          deviceId: req.body.deviceId
        };

        CommonImport.utils.cleanup(reqBody);

        const authGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.auth]);

        authGrpcClient.signInV1(reqBody, metadata, (err, tokens) => {
          if (err) {
            return next(err);
          }

          const decodedRT = CommonImport.jwt.decode(tokens.refreshToken);

          const cookieOpts = Object.assign({}, cookieBaseOpts, {
            expires: new Date(decodedRT.exp * 1000)
          });

          res.cookie('accessToken', tokens.accessToken, cookieOpts);
          res.cookie('refreshToken', tokens.refreshToken, cookieOpts);

          /********************************************************** Start: for zipkin. *******************************************************/
          try {
            global.ZIPKIN_GRPC_INTCP.afterGrpcCallFinish();
          } catch (e) {
            // Nothing need to be done here.
          }
          /*********************************************************** End: for zipkin. ********************************************************/

          res.json({
            success: true
          });
        });

      } else {
        return next(new CommonImport.errors.UncategorizedError.InvalidRequest());
      }

    }
    
  }

}

module.exports = Auth;


