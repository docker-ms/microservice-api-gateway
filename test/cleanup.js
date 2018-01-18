'use strict';

after((done) => {

  const {Promise, config, mongodb} = global.T;

  // `setTimeout` for safely clean up.
  setTimeout(() => {
    Promise.join(
      mongodb.collection(config.mongodbCollectionNames.companies).deleteMany({tester: config.tester}),
      mongodb.collection(config.mongodbCollectionNames.users).deleteMany({tester: config.tester}),
      mongodb.collection(config.mongodbCollectionNames.groups).deleteMany({tester: config.tester}),
      mongodb.collection(config.mongodbCollectionNames.conversations).deleteMany({tester: config.tester}),
      () => {
        delete global.T;

        done();
      }
    ).catch((e) => {
      done(e);
    });
  }, 6000);

});


