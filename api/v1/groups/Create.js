'use strict';

const CommonImport = require('../../../util/CommonImport');

class Create {

  static get apiType() {
    return 'POST';
  }

  static create(req, res, next) {

    const _createGroup = (groupId) => {
      if (req.body.memberUserIds.indexOf(req.user.uid) === -1) {
        req.body.memberUserIds.push(req.user.uid);
      }
      req.body.creatorUserId = req.user.uid;
      return CommonImport.utils.bluebirdRetryExecutor(() => {
        const groupsGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.groups]);
        return new CommonImport.Promise((resolve, reject) => {
          return groupsGrpcClient.createGroupV1(Object.assign(req.body, {groupId: groupId}), (err, data) => {
            if (err) {
              return reject(err);
            }
            return resolve(data);
          });
        });
      }, {}).reflect();
    };

    const _createConversation = (groupId) => {
      return CommonImport.utils.bluebirdRetryExecutor(() => {
        const chatGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.chat]);
        return new CommonImport.Promise((resolve, reject) => {
          const tmp = {
            conversationId: groupId,
            conversationType: CommonImport.protos.enums.conversationTypes.GROUP,
            creatorUserId: req.user.uid
          };
          // Only serve automated testing purpose.
          if (req.body.tester) {
            tmp.tester = req.body.tester;
          }
          return chatGrpcClient.createConversationV1(tmp, (err, data) => {
            if (err) {
              return reject(err);
            }
            return resolve(data);
          });
        });
      }, {}).reflect();
    };

    const groupId = CommonImport.shortid.generate();

    CommonImport.Promise.join(
      _createGroup(groupId),
      _createConversation(groupId),
      (createGroupInspection, createConversationInspection) => {
        const isGroupCreationSuccessful = createGroupInspection.isFulfilled();
        const isConversationCreationSuccessful = createConversationInspection.isFulfilled();
        if (isGroupCreationSuccessful && isConversationCreationSuccessful) {
          res.send({
            groupId: groupId,
            conversationId: groupId
          });
        } else if (isGroupCreationSuccessful) {
          
          /*
           * Successfully created the group but didn't successfully created the conversation,
           * need to return error, and then delete the created group.
           *
           * Orphan operations, we will use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
           */
          CommonImport.utils.bluebirdRetryExecutor(() => {
            const groupsGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.groups]);
            return new CommonImport.Promise((resolve, reject) => {
              return groupsGrpcClient.deleteGroupV1({groupId: groupId}, (err, data) => {
                if (err) {
                  return reject(err);
                }
              });
            });
          }, {}).then(() => {
            // Nothing need to be done here.
          }).catch((err) => {
            // TODO: use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
            console.log(err);
          });

          console.log(createConversationInspection.reason());

          // let the process go.
          return CommonImport.Promise.reject(new Error('Failed to create conversation.'));

        } else if (isConversationCreationSuccessful) {

          /*
           * Successfully created the conversation but didn't successfully created the group,
           * need to return error, and then delete the created conversation.
           *
           * Orphan operations, we will use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
           */
          CommonImport.utils.bluebirdRetryExecutor(() => {
            const chatGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.chat]);
            return new CommonImport.Promise((resolve, reject) => {
              return chatGrpcClient.deleteConversationV1({forGroupId: groupId}, (err, data) => {
                if (err) {
                  return reject(err);
                }
                return resolve(data);
              });
            });
          }, {}).then(() => {
            // Nothing need to be done here.
          }).catch((err) => {
            // TODO: use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
            console.log(err);
          });

          // let the process go.
          return CommonImport.Promise.reject(createGroupInspection.reason());

        } else {
          // let the process go.
          return CommonImport.Promise.reject(new Error('Failed to create group and conversation.'));
        }
      }
    ).catch((err) => {
      next(err);
    });

  }

}

module.exports = Create;


