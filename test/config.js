'use strict';

const testUserEmailBase = 'leonard.shi+000000@vcube.co.jp';

module.exports = {

  allTlsCertDomains: ['localhost', '*.sgdev.vcube.com'],

  targetDomainIdx: 0,

  // `key` need to be one valid domain name.
  // `value` is an Array of the WebSocket servers working under this domain.
  wsServers: {
    localhost: ['wss://localhost:9999/vcube']
  },

  mongodbConnUrl: 'mongodb://10.0.1.6:27017,10.0.2.101:27017/microservices',

  mongodbCollectionNames: {
    users: 'Users',
    groups: 'Groups',
    companies: 'Companies',
    conversations: 'Conversations',
    messages: 'Messages',
    messageReadStatuses: 'MessageReadStatuses'
  },

  gatewayUrl: 'https://localhost:53547',

  tester: 'leonard',

  fixedUserInitialPwd: '__-Hy1vSTlBb-__',

  testUserEmailBase: testUserEmailBase,
  testUserEmailArr: new Array(10).fill(testUserEmailBase).map((item, idx) => {return item.replace('@', `${idx}@`)}),

  sampleMessage: "Leonard's sample test message."

};


