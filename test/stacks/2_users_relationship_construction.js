'use strict';

let config, cookie, shortid, Promise, request, bluebirdBasedRequest, expect, mongodb;

let requestId, usersInfo, group, conversations;

describe('Users relationship construction stack:', () => {

  it('0: acquire necessaries from the `global.T`', (done) => {
    ({config, cookie, shortid, Promise, request, bluebirdBasedRequest, expect, mongodb} = global.T);
    done();
  });

  it('1: user sign in / get `accessToken` and `refreshToken`: /api/v1/auth/Auth', (done) => {

    usersInfo = global.T.usersInfo = [];

    const doSignIn = config.testUserEmailArr.reduce((acc, curr) => {
      acc.push(
        bluebirdBasedRequest.post({
          uri: '/api/v1/auth/Auth',
          resolveWithFullResponse: true,

          body: {
            lang: 'en',
            requestId: shortid.generate(),

            email: curr,
            pwd: config.fixedUserInitialPwd
          }
        })
      );
      return acc;
    }, []);

    Promise.all(doSignIn).then((allRes) => {
      allRes.forEach((res, idx) => {

        expect(res.body.success).to.be.true;
        expect(res.statusMessage).to.be.a('string');

        const userInfo = {
          email: config.testUserEmailBase.replace('@', `${idx}@`)
        };

        Array.from(res.headers['set-cookie']).forEach((ck) => {
          const parsedCookie = cookie.parse(ck);
          userInfo.accessToken = userInfo.accessToken || parsedCookie.accessToken;
          userInfo.refreshToken = userInfo.refreshToken || parsedCookie.refreshToken;
        });

        usersInfo.push(userInfo);
      });

      /*
       * Match `userId`
       */
      mongodb.collection(config.mongodbCollectionNames.users).find({
        email: {
          $in: config.testUserEmailArr
        }
      }, {
        _id: 0,
        email: 1,
        userId: 1
      }).toArray((e, res) => {
        if (e) {
          return done(e);
        }

        res.forEach((user) => {
          usersInfo[+user.email[user.email.indexOf('@') - 1]].userId = user.userId;
        });

        done();
      });
    });

  });

  it('2: `user 0` send friend request to `user 1 - 9`: /api/v1/users/contact/add', (done) => {

    const userIds4User1To9 = usersInfo.reduce((acc, curr, idx) => {
      if (idx !== 0) {
        acc.push(curr.userId);
      }
      return acc;
    }, []);

    requestId = shortid.generate();

    bluebirdBasedRequest.post({
      uri: '/api/v1/users/contact/add',
      resolveWithFullResponse: true,

      headers: {
        Cookie: `accessToken=${usersInfo[0].accessToken}`
      },

      body: {
        lang: 'en',
        requestId: requestId,

        targetUserUserIds: userIds4User1To9
      }
    }).then((res) => {
      expect(res.body.success).to.be.true;
      expect(res.statusMessage).to.be.equal(requestId);

      done();
    });

  });

  it('3: `user 1 - 9` accept friend request from `user 0`: /api/v1/users/contact/confirm', (done) => {

    const doAcceptFriendReq = Array(9).fill().map((_, idx) => idx + 1).reduce((acc, curr) => {
      acc.push(
        bluebirdBasedRequest.post({
          uri: '/api/v1/users/contact/confirm',
          resolveWithFullResponse: true,

          headers: {
            Cookie: `accessToken=${usersInfo[curr].accessToken}`
          },

          body: {
            lang: 'en',
            requestId: shortid.generate(),

            initiatorUserId: usersInfo[0].userId
          }
        })
      );
      return acc;
    }, []);

    Promise.all(doAcceptFriendReq).then((allRes) => {
      allRes.forEach((res) => {
        expect(res.body.success).to.be.true;
        expect(res.statusMessage).to.be.a('string');
      });

      done();
    });

  });

  it('4: `user 0` create group with members `user 1 - 9`: /api/v1/groups/Create', (done) => {

    const userIds4User1To9 = usersInfo.reduce((acc, curr, idx) => {
      if (idx !== 0) {
        acc.push(curr.userId);
      }
      return acc;
    }, []);

    requestId = shortid.generate();

    bluebirdBasedRequest.post({
      uri: '/api/v1/groups/Create',
      resolveWithFullResponse: true,

      headers: {
        Cookie: `accessToken=${usersInfo[0].accessToken}`
      },

      body: {
        lang: 'en',
        requestId: requestId,

        groupName: `Leonard's test group`,
        memberUserIds: userIds4User1To9,

        tester: config.tester
      }
    }).then((res) => {
      expect(res.body.groupId).to.be.a('string');
      expect(res.body.conversationId).to.be.a('string');

      expect(res.statusMessage).to.be.equal(requestId);

      group = global.T.group = {
        groupId: res.body.groupId,
        memberUserIds: userIds4User1To9
      };

      done();
    });

  });

});


