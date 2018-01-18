'user strict';

const {
  GraphQLBoolean,
  GraphQLString,
  GraphQLObjectType
} = require('graphql');

const MobilePhone = new GraphQLObjectType({
  name: 'MobilePhone',
  fields: {
    isVerified: {
      type: GraphQLBoolean
    },
    alpha3CountryCode: {
      type: GraphQLString
    },
    mobilePhoneNoWithCountryCallingCode: {
      type: GraphQLString
    }
  }
});

module.exports = {
  MobilePhone: MobilePhone
}


