'use strict';

global.IS_PROD_MODE = !!process.env.RUN_MODE && process.env.RUN_MODE === 'PROD';

if (!process.env.SERVICE_TAG_SUFFIX) {
  throw new Error('You need to specify your service environment tag.');
}

const CommonImport = require('./util/CommonImport');

const os = require('os');
const fs = require('fs');
const tls = require('tls');
const https = require('https');
const cluster = require('cluster');

const multer = require('multer');

const tmpUploadBasePath = 'public/upload/';
const subdirectoryConversation = CommonImport.path.resolve(__dirname, tmpUploadBasePath, 'conversation');
const subdirectoryConversationTmp = CommonImport.path.resolve(__dirname, tmpUploadBasePath, 'conversation/tmp');

const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const reqUrl = req.url.toLowerCase();
    let destPath;
    if (reqUrl.includes('sendmessage')) {
      if (req.body.toConversationId) {
        destPath = CommonImport.path.resolve(
          tmpUploadBasePath,
          subdirectoryConversation,
          CommonImport.moment().format('YYYYMMDD'),
          req.user.cid,
          req.body.toConversationId
        );
      } else {
        destPath = subdirectoryConversationTmp;
      }
      CommonImport.mkdirp(destPath, (err) => {
        if (err) {
          // Should have no chance coming here.
          callback(err);
        }
        callback(null, destPath);
      });
    }
  },
  filename: (req, file, callback) => {
    const generatedFilename = +new Date()
                              + CommonImport.utils.commonSeparator
                              + CommonImport.shortid.generate()
                              + file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);

    callback(null, generatedFilename);
  }
});

const multerToDisk = multer({
  storage: diskStorage
});

const multerToMemory = multer({
  storage: memoryStorage
})

const tlsCertsBasePath = CommonImport.path.join(__dirname, './tls_certs');

const tokenNotRequiredWhenMatch = [
  /^\/$/,
  /.*.ico$/,
  /^\/images\/.*$/i,
  /\/api\/v\d\/auth\/Auth$/i
];

/*
 * global variables define.
 */
global.CONSUL = require('microservice-consul');

global.serviceTags = {
  util: 'util-' + (process.env.SERVICE_TAG_SUFFIX || ''),

  auth: 'auth-' + (process.env.SERVICE_TAG_SUFFIX || ''),
  chat: 'chat-' + (process.env.SERVICE_TAG_SUFFIX || ''),
  lsync: 'lsync-' + (process.env.SERVICE_TAG_SUFFIX || ''),
  users: 'users-' + (process.env.SERVICE_TAG_SUFFIX || ''),
  groups: 'groups-' + (process.env.SERVICE_TAG_SUFFIX || ''),
  companies: 'companies-' + (process.env.SERVICE_TAG_SUFFIX || '')
};

const gqlSchema = require('./graphql/schema');

if (cluster.isMaster) {
  /*
   * The master process should be kept as light as it can be, that is: only do the workers management jobs.
   */

  const numOfWorkers = os.cpus().length;
  for (var i = 0; i < numOfWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    cluster.fork();
  });

} else {

  /*
   * Here the woker process will always be full featured.
   */

  CommonImport.utils.bluebirdRetryExecutor(() => {

    let doInitialization = [];

    doInitialization.push(
      require('microservice-logger')(global.CONSUL.keys['loggerWinstonGate'])
    );

    doInitialization.push(
      CommonImport.utils.getLatestAliveGrpcClientsAndRemoveDeadServices(
        global.CONSUL.agents,
        Object.keys(global.serviceTags).map(key => global.serviceTags[key]),
        CommonImport.grpc,
        CommonImport.protos
      )
    );

    doInitialization.push(
      require('microservice-rabbitmq-channels-pool')(global.CONSUL.keys['rabbitmq'], [], process.env.SERVICE_TAG_SUFFIX)
    );

    doInitialization.push(CommonImport.utils.pickRandomly(global.CONSUL.agents).kv.get(global.CONSUL.keys['jwtGate']));

    doInitialization = doInitialization.concat([
      CommonImport.Promise.promisify(CommonImport.mkdirp)(CommonImport.path.resolve(__dirname, tmpUploadBasePath, subdirectoryConversation))
    ]);

    doInitialization = global.CONSUL.keys.tlsCerts.reduce((acc, curr) => {
      Object.keys(curr).forEach((item) => {
        if (item !== 'domain') {
          acc.push(
            CommonImport.utils.writeConsulDataToFile(
              global.CONSUL.agents, curr[item].consulKey,
              CommonImport.path.join(tlsCertsBasePath, curr.domain), curr[item].filename
            )
          );
        }
      });
      return acc;
    }, doInitialization);

    return CommonImport.Promise.all(doInitialization).then((results) => {

      if (!results[0]) {
        return CommonImport.Promise.reject(new Error('Failed to build logger winston.'));
      }

      global.logger = results[0].logger;

      global.logMetaData = {
        pid: process.pid,
        '@target_index': results[0].logOpts.elasticsearchIndexNames.microservices,
        // TODO:
        //   Every 00:00:00.000' need to refresh this field.
        '@target_type': process.env.MS_SERVICE_TAG + '-' + CommonImport.utils.nthDayOfEpoch
      };

      global.logger.info('Logger winston initialized.', global.logMetaData);

      if (Object.keys(results[1]).length !== Object.keys(global.serviceTags).length) {
        return CommonImport.Promise.reject(new CommonImport.errors.RetryRecoverable());
      }

      if (!results[2].channels.length) {
        return CommonImport.Promise.reject(new Error('None of the RabbitMQ servers is available.'));
      }

      global.logger.info('Successfully attained RabbitMQ cluster info.', global.logMetaData);
      global.logger.debug('RabbitMQ cluster info: ', Object.assign({aux: [results[2]]}, global.logMetaData));


      if (!results[3]) {
        return CommonImport.Promise.reject(new Error('Invalid gate JWT configurations.'));
      }

      global.logger.info('Successfully attained gate JWT configurations.', global.logMetaData);
      global.logger.debug('Gate JWT configurations: ', Object.assign({aux: [results[3]]}, global.logMetaData));

      global.GRPC_CLIENTS = results[1];

      global.RabbitMQ = results[2];

      global.JWT_GATE_OPTS = JSON.parse(results[3].Value);

      const express = require('express');
      const expressJWT = require('express-jwt');
      const expressGQL = require('express-graphql');
      const app = express();
      const bodyParser = require('body-parser');
      const cookieParser = require('cookie-parser');
      const compression = require('compression');

      // For Postman 'raw' option and set 'Content-Type: application/json' header.
      app.use(bodyParser.json({
        type: 'application/json'
      }));

      // For Postman 'x-www-form-urlencoded' option, don't need to set any header.
      app.use(bodyParser.urlencoded({
        extended: true
      }));

      app.use(compression());

      app.use(cookieParser());

      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
        next();
      });

      app.use(expressJWT({
        secret: new Buffer(global.JWT_GATE_OPTS.strSecret),
        credentialsRequired: true,
        getToken: (req) => {
          if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            return req.headers.authorization.split(' ')[1];
          } else if (req.cookies && req.cookies.accessToken) {
            return req.cookies.accessToken;
          } else if (req.query && req.query.at) {
            return req.query.at;
          }
          return null;
        }
      }).unless({
        method: 'OPTIONS',
        path: tokenNotRequiredWhenMatch
      }));

      /********************************************************** Start: for zipkin. **********************************************************/

      const zipkinBaseUrl = `http://${process.env.MS_SERVICE_TAG.indexOf('localhost') == -1 ?
                                        'zipkin_server_0:9411' : 'micro02.sgdev.vcube.com:64800'}`;

      /*
       * 'zipkin-context-cls' implements a context API on top of
       * 'CLS/continuation-local-storage(https://github.com/othiym23/node-continuation-local-storage)'.
       *
       * The primary objective of CLS is to implement a transparent context API, that is: you don't need to pass around a ctx variable everywhere
       * in your application code.
       *
       * A note on CLS context vs. explicit context:
       *   There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
       *   the drawback then is that you have to pass around a context object manually.
       */
      const CLSContext = require('zipkin-context-cls');

      const {Tracer, BatchRecorder, ConsoleRecorder} = require('zipkin');
      const {HttpLogger} = require('zipkin-transport-http');

      const recorder = new BatchRecorder({
        logger: new HttpLogger({
          endpoint: `${zipkinBaseUrl}/api/v1/spans`
        })
      });

      // `ConsoleRecorder` will be very helpful when you want to debug where is going wrong.
      // const recorder = new ConsoleRecorder();

      const ctxImpl = new CLSContext('zipkin');

      const tracer = new Tracer({ctxImpl, recorder});

      const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

      app.use(zipkinMiddleware({
        tracer,
        serviceName: process.env.MS_SERVICE_TAG,
        port: 53547
      }));

      global.ZIPKIN_GRPC_INTCP = new (require('zipkin-instrumentation-grpc'))(tracer);

      /*********************************************************** End: for zipkin. ***********************************************************/

      app.use(express.static(CommonImport.path.join(__dirname, './public')));

      // Hide 'upload' and 'cid'.
      app.use((req, res, next) => {
        if (/^\/resources\/conversation\/.*$/.test(req.url)) {
          return res.redirect(301, req.url.replace(/^\/resources(\/conversation\/\d{8}\/)/, `/upload$1${req.user.cid}/`));
        }
        next();
      });

      // Make the request go through the API common checks and normalization stack.
      app.use((req, res, next) => {
        require('./util/ApiInputCommonCheckAndnormalizationStack')(req, res, next);
      });

      app.get('/', (req, res) => {
        res.send('Hello, this is microservice api gateway server.');
      });

      const fsWalk = require('walk');

      const fsWalker = fsWalk.walk(CommonImport.path.join(__dirname, './api'), {
        followLinks: false
      });

      const apis = [];

      fsWalker.on('file', (filePath, fileStats, next) => {
        apis.push([filePath, fileStats]);
        next();
      });

      fsWalker.on('end', () => {

        for (let i = 0; i < apis.length; i++) {
          let filePath = apis[i][0];
          let fileStats = apis[i][1];

          let modulePath = filePath.substring(__dirname.length, filePath.length);
          let moduleName = fileStats.name.substring(0, fileStats.name.length - 3);

          let module = require('.' + modulePath + '/' + moduleName);

          // In future we may append dynamic strings to handle dynamic 'GET' and 'DELETE' APIs.
          let baseApiPath = (modulePath + '/' + moduleName).toLowerCase();

          let methodName = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

          switch (module.apiType) {
            case 'GET':
              app.get(baseApiPath + (module.paramsTpl || ''), (req, res, next) => {
                try {
                  module[methodName](req, res, next);
                } catch (err) {
                  return next(err);
                }
              });
              break;
            case 'POST':
              app.post(baseApiPath + (module.paramsTpl || ''), (req, res, next) => {
                try {
                  module[methodName](req, res, next);
                } catch (err) {
                  return next(err);
                }
              });
              break;
            case 'PUT':
              app.put(baseApiPath + (module.paramsTpl || ''), (req, res, next) => {
                try {
                  module[methodName](req, res, next);
                } catch (err) {
                  return next(err);
                }
              });
              break;
            case 'MULTER':
              const upload = module.multerOpts.needToPersist? multerToDisk : multerToMemory;
              switch (module.multerOpts.type) {
                case 'single':
                  app.post(baseApiPath + (module.paramsTpl || ''), upload.single(module.multerOpts.val), (req, res, next) => {
                    // Check mimetypes before proceeding the request.
                    if (module.multerOpts.supportedMimetypes.indexOf(req.file.mimetype) === -1) {
                      return next(new CommonImport.errors.NotSupported.FileTypeNotSupported());
                    }
                    try {
                      module[methodName](req, res, next);
                    } catch (err) {
                      return next(err);
                    }
                  });
                  break;
                case 'array':
                  app.post(
                    baseApiPath + (module.paramsTpl || ''),
                    upload.array(module.multerOpts.val.fieldName, module.multerOpts.val.maxCount),
                    (req, res, next) => {
                      // Check mimetypes before proceeding the request.
                      Array.isArray(req.files) && req.files.every((resource) => {
                        if (module.multerOpts.supportedMimetypes.indexOf(resource.mimetype) === -1) {
                          next(new CommonImport.errors.NotSupported.FileTypeNotSupported());
                          return false;
                        }
                        return true;
                      });
                      try {
                        module[methodName](req, res, next);
                      } catch (err) {
                        return next(err);
                      }
                    }
                  );
                break;
              }
              break;
          }
        }

        app.use('/gql', expressGQL({
          schema: gqlSchema,
          graphiql: true
        }));

        app.use((err, req, res, next) => {
          if (global.IS_PROD_MODE) {
            if (err.constructor.name === 'MicroserviceErrorBase') {
              res.status(err.code).send({errCode: err.message});
            } else {
              const unknownError = new CommonImport.errors.UnknownError();
              res.status(unknownError.httpStatusCode).send({errCode: unknownError.errCode});
            }
          } else {
            return next(err);
          }
        });

        const options = {
          SNICallback: (domain, callback) => {
            const targetDomainCerts = global.CONSUL.keys.tlsCerts.find((item) => {
              return domain.indexOf(item.domain.replace('*.', '')) !== -1;
            });

            const ctx = tls.createSecureContext({
              key: fs.readFileSync(CommonImport.path.join(tlsCertsBasePath, targetDomainCerts.domain, targetDomainCerts.key.filename)),
              cert: fs.readFileSync(CommonImport.path.join(tlsCertsBasePath, targetDomainCerts.domain, targetDomainCerts.cert.filename)),
              ca: [fs.readFileSync(CommonImport.path.join(tlsCertsBasePath, targetDomainCerts.domain, targetDomainCerts.ca.filename))]
            });

            callback(null, ctx);
          },
          requestCert: true,
          rejectUnauthorized: false
        };

        https.createServer(options, app).listen(53547);

      });

      return CommonImport.Promise.resolve();

    });

  }, {interval: 5000, timeout: 600000, maxTries: 65535});

}


