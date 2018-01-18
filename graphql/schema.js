'use strict';

const CommonImport = require('../util/CommonImport');

const {
  GraphQLString,
  GraphQLNonNull
} = require('graphql');

const Users = require('./types/Users');

const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList
} = require('graphql');

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
      users: {
        type: new GraphQLList(Users),
        args: {
          userIds: {
            type: new GraphQLList(new GraphQLNonNull(GraphQLString))
          }
        },
        resolve(rootValue, args) {
          const usersGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.users]);
          return new CommonImport.Promise((resolve, reject) => {
            usersGrpcClient.queryUsersV1({
              criteriaStr: JSON.stringify({
                userId: {
                  $in: args.userIds
                }
              })
            }, (err, res) => {
              if (err) {
                // What can I do here?
              }
              return resolve(
                res.users.filter((user) => {
                  return args.userIds.indexOf(user.userId) !== -1;
                })
              );
            });
          });
        }
      }
    }
  })
});

module.exports = schema;


