'use strict';

let fs, path, config, cookie, shortid, request, expect, mongodb;

let requestId, branchSetupToken, companyId;

describe('Branch setup stack:', () => {

  it('0: acquire necessaries from the `global.T`', (done) => {
    ({fs, path, config, cookie, shortid, request, expect, mongodb} = global.T);
    done();
  });

  it('1: get branch setup token: /api/v1/auth/Auth', (done) => {

    requestId = shortid.generate();

    request.post({
      uri: '/api/v1/auth/Auth',
      body: {
        lang: 'en',
        requestId: requestId,

        branchCode: 'vcubegs-sg',
        pwd: '1234567890',
        deviceId: shortid.generate()
      }
    }, (e, res) => {

      if (e) {
        return done(e);
      }

      branchSetupToken = cookie.parse(res.headers['set-cookie'].toString()).accessToken;

      try {
        expect(branchSetupToken).to.be.a('string');
        expect(res.statusMessage).to.be.equal(requestId);

        done();
      } catch (e) {
        done(e);
      }

    });

  });

  it('2: create company with the setup token: /api/v1/companies/Create', (done) => {

    requestId = shortid.generate();

    request.post({
      uri: '/api/v1/companies/Create',
      headers: {
        Cookie: `accessToken=${branchSetupToken}`
      },
      body: {
        lang: 'en',
        requestId: requestId,

        companyName: "Leonard's Test Company",
        email: 'leonard.shi@vcube.co.jp',
        address: '10 Collyer Quay #03-06 Ocean Financial Centre Singapore 049315',
        mobilePhone: {
          alpha3CountryCode: 'SGP',
          mobilePhoneNoWithCountryCallingCode: '+6590459999'
        },

        tester: config.tester
      }
    }, (e, res) => {

      if (e) {
        return done(e);
      }

      try {
        expect(res.body.success).to.be.true;
        expect(res.statusMessage).to.be.equal(requestId);

        mongodb.collection(config.mongodbCollectionNames.companies).findOne({
          tester: config.tester
        }, {
          fields: {
            companyId: 1
          },
          sort: {
            createAt: -1
          }
        }, (e, res) => {

          if (e) {
            return done(e);
          }

          companyId = res.companyId;

          done();

        });
      } catch (e) {
        done(e);
      }

    });

  });

  it('3: create company admin with the setup toekn: /api/v1/users/Regist', (done) => {

    requestId = shortid.generate();

    request.put({
      uri: '/api/v1/users/Regist',
      headers: {
        Cookie: `accessToken=${branchSetupToken}`
      },
      body: {
        lang: 'en',
        requestId: requestId,

        companyId: companyId,
        realName: 'Leonard Shi 0000000',
        gender: 'M',
        email: 'leonard.shi+0000000@vcube.co.jp',
        "mobilePhone":{
          "alpha3CountryCode": "SGP",
          "mobilePhoneNoWithCountryCallingCode": "+6590000000"
        },

        tester: config.tester
      }
    }, (e, res) => {

      if (e) {
        return done(e);
      }

      try {
        expect(res.body.success).to.be.true;
        expect(res.statusMessage).to.be.equal(requestId);

        done();
      } catch (e) {
        done(e);
      }

    });

  });

  it('4: batch register normal users: /api/v1/users/BatchRegist', (done) => {

    requestId = shortid.generate();

    const formData = {
      lang: 'en',
      requestId: requestId,

      companyId: companyId,
      users: fs.createReadStream(path.resolve(__dirname, '../data/users.csv')),

      tester: config.tester
    };

    request.post({
      uri: '/api/v1/users/BatchRegist',
      headers: {
        Cookie: `accessToken=${branchSetupToken}`
      },
      formData: formData
    }, (e, res) => {

      if (e) {
        return done(e);
      }

      try {
        expect(res.body.success).to.be.true;
        expect(res.statusMessage).to.be.equal(requestId);

        done();
      } catch (e) {
        done(e);
      }

    });

  });

});


