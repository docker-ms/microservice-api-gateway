'use strict';

module.exports = {
  jwt: require('jsonwebtoken'),
  path: require('path'),
  grpc: require('grpc'),
  uuidV4: require('uuid/v4'),
  shortid: require('shortid'),
  Promise: require('bluebird'),
  moment: require('moment'),
  mkdirp: require('mkdirp'),
  sizeof: require('object-sizeof'),

  i18n: require('microservice-i18n'),
  utils: require('microservice-utils'),
  protos: require('microservice-protos'),
  errors: require('microservice-errors')
};


