'use strict';

before((done) => {

  const config = require('./config');

  if (!config.gatewayUrl || typeof config.gatewayUrl !== 'string') {
    throw new Error("You need to provide the http gateway url in the 'config.js'.");
  }

  const path = require('path');

  const tlsCertPaths = config.allTlsCertDomains.reduce((acc, curr) => {
    acc[curr] = {
      ca: path.resolve(__dirname, `./tls_certs/${curr}/tls_${curr}_root_ca.pem`),
      cert: path.resolve(__dirname, `./tls_certs/${curr}/tls_${curr}_server_cert.pem`),
      key: path.resolve(__dirname, `./tls_certs/${curr}/tls_${curr}_server_cert_private_key.pem`)
    };
    return acc;
  }, {});

  const chai = require('chai');
  const {assert, expect} = chai;
  const should = chai.should();

  const fs = require('fs');

  const targetDomain = config.allTlsCertDomains[config.targetDomainIdx];

  const defaultOpts = {
    json: true,
    baseUrl: config.gatewayUrl,

    ca: fs.readFileSync(tlsCertPaths[targetDomain].ca),
    cert: fs.readFileSync(tlsCertPaths[targetDomain].cert),
    key: fs.readFileSync(tlsCertPaths[targetDomain].key)
  };

  const request = require('request');
  const requestWithDefaults = request.defaults(defaultOpts);

  const bluebirdBasedRequest = require('request-promise');
  const bluebirdBasedRequestWithDefaults = bluebirdBasedRequest.defaults(defaultOpts);

  const Promise = require('bluebird');

  Promise.promisify(require('mongodb').MongoClient.connect)(config.mongodbConnUrl).then((db) => {

    global.T = {
      config: config,

      nedb: new (require('nedb'))({inMemoryOnly: true}),

      mongodb: db,

      request: requestWithDefaults,
      bluebirdBasedRequest: bluebirdBasedRequestWithDefaults,

      assert: assert,
      expect: expect,
      should: should,

      tlsCertPaths: tlsCertPaths,

      fs: fs,
      path: path,

      Promise: Promise,

      ws: require('ws'),
      cookie: require('cookie'),
      shortid: require('shortid'),
      msgpack: require('msgpack'),

      util: require('./util/Util')
    };

    done();
  });

});


