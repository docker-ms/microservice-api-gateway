'use strict';

const enums = require('../../util/CommonImport').protos.enums;

const {
  GraphQLInt,
  GraphQLString,
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull
} = require('graphql');

const commonTypes = require('./common');

module.exports = new GraphQLObjectType({
  name: 'Self',
  fields: () => ({
    userId: {
      type: new GraphQLNonNull(GraphQLString)
    },
    userSetId: {
      type: GraphQLString
    },
    companyId: {
      type: GraphQLString
    },
    realName: {
      type: GraphQLString
    },
    displayName: {
      type: new GraphQLNonNull(GraphQLString)
    },
    gender: {
      type: GraphQLInt,
      resolve: (obj) => {
        return enums.genders[obj.gender];
      }
    },
    email: {
      type: GraphQLString
    },
    isEmailVerified: {
      type: GraphQLBoolean
    },
    mobilePhone: {
      type: commonTypes.MobilePhone
    },
    userStatus: {
      type: GraphQLInt,
      resolve: (obj) => {
        return enums.userStatuses[obj.userStatus];
      }
    },
    confirmedContacts: {
      type: new GraphQLList(GraphQLString)
    },
    unconfirmedContacts: {
      type: new GraphQLList(GraphQLString)
    },
    activeConversations: {
      type: new GraphQLList(GraphQLString)
    }
  }),
  isTypeOf: (data) => !!data.userId
});


