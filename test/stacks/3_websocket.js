'use strict';

let config, cookie, shortid, Promise, msgpack, request, bluebirdBasedRequest, expect, fs, util, tlsCertPaths, ws, usersInfo, group, conversations;

let activeTlsCertPaths, userSockets;

describe('WebSocket related, message sending stack:', () => {

  it('0: acquire necessaries from the `global.T`', (done) => {
    ({config, cookie, shortid, Promise, msgpack, request, bluebirdBasedRequest, expect, fs, util, tlsCertPaths, ws, usersInfo, group, conversations} = global.T);

    activeTlsCertPaths = tlsCertPaths[config.allTlsCertDomains[config.targetDomainIdx]];

    done();
  });

  it('1: connect to WebSocket server', (done) => {
    const tlsKey = fs.readFileSync(activeTlsCertPaths.key);
    const tlsCert = fs.readFileSync(activeTlsCertPaths.cert);
    const tlsCa = fs.readFileSync(activeTlsCertPaths.ca);

    userSockets = usersInfo.reduce((acc, curr) => {
      const socket = new ws(util.pickRandomly(config.wsServers[config.allTlsCertDomains[config.targetDomainIdx]]), {
        key: tlsKey,
        cert: tlsCert,
        ca: tlsCa,

        rejectUnauthorized: false,
        headers: {
          Cookie: `accessToken=${curr.accessToken};refreshToken=${curr.refreshToken}`
        }
      });

      acc.push(socket);

      return acc;
    }, []);

    done();
  });

  it('2: `user 0` send one message to group: /api/v1/chat/SendMessage', (done) => {

    for (let i = 1; i < 10; i++) {
      userSockets[i].once('message', (data, flags) => {
        expect(JSON.parse(data).content).to.equal(config.sampleMessage);
      });
    }

    const formData = {
      lang: 'en',

      messageType: 'TEXT',
      toConversationId: group.groupId,
      forGroupId: group.groupId,
      conversationType: 'GROUP',
      content: config.sampleMessage,
      mentionedUserUserIds: [usersInfo[1].userId, usersInfo[2].userId]
    };

    bluebirdBasedRequest.post({
      uri: '/api/v1/chat/SendMessage',

      headers: {
        Cookie: `accessToken=${usersInfo[0].accessToken}`
      },

      formData: formData
    }).then((resBody) => {
      expect(Object.keys(resBody.targetUsers).length).to.equal(usersInfo.length);
      expect(Object.keys(resBody.mentionedUserUserIds).length).to.equal(2);

      done();
    });

  });

});


