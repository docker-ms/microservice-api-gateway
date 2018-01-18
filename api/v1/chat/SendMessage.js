'use strict';

const multimediaItemMaxCount = 9;

const CommonImport = require('../../../util/CommonImport');

const RabbitMQ = require('../../../util/RabbitMQ');

class SendMessage {

  static get apiType() {
    return 'MULTER';
  }

  static get multerOpts() {
    return {
      type: 'array',
      val: {
        fieldName: 'resources',
        maxCount: multimediaItemMaxCount
      },
      needToPersist: true,
      supportedMimetypes: [
        // text
        'application/xml',
        'application/json',
        'text/csv',
        'text/tab-separated-values',
        'application/pdf',

        // image
        'image/gif',
        'image/png',
        'image/jpeg',
        'image/pjpeg',
        'image/bmp',
        'image/x-icon',

        // audio
        'audio/wav',
        'audio/x-wav',
        'audio/mpeg3',
        'audio/x-mpeg-3',
        'audio/mpeg',

        // video
        'application/x-shockwave-flash',
        'video/x-ms-asf',
        'video/avi',
        'video/msvideo',
        'video/x-msvideo'
      ]
    };
  }

  static sendMessage(req, res, next) {

    const toBeSubmittedMessage = {
      lang: req.body.lang,
      messageType: req.body.messageType,
      content: req.body.content,
      sender: req.user.uid,
      toConversationId: req.body.toConversationId,
      conversationType: req.body.conversationType,
      forGroupId: req.body.forGroupId,
      mentionedUserUserIds: req.body.mentionedUserUserIds,
      mentionedMessageMessageIds: req.body.mentionedMessageMessageIds
    };

    if (req.body.toUserId) {

      delete req.body.mentionedUserUserIds;
      delete req.body.mentionedMessageMessageIds;

      const conversationId = CommonImport.uuidV4();

      const _createConversation = () => {
        return CommonImport.utils.bluebirdRetryExecutor(() => {
          const chatGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.chat]);
          return new CommonImport.Promise((resolve, reject) => {
            return chatGrpcClient.createConversationV1({
              conversationId: conversationId,
              conversationType: req.body.conversationType,
              memberUserIds: [req.user.uid, req.body.toUserId],
              isTemp121ConversationEnabled: true,
              creatorUserId: req.user.uid
            }, (err, data) => {
              if (err) {
                return reject(err);
              }
              return resolve(data);
            });
          });
        }, {});
      };

      _createConversation().then((data) => {

        toBeSubmittedMessage.toConversationId = data.conversationId;

        let moveFiles = {};
        let createNecessaryDirectories;

        toBeSubmittedMessage.resources = [];

        if (Array.isArray(req.files)) {
          createNecessaryDirectories = req.files.reduce((acc, curr) => {
            const realPathShouldBe = curr.path.replace(
              /\/tmp\//,
              `/${CommonImport.moment().format('YYYYMMDD')}/${req.user.cid}/${data.conversationId}/`
            );
            toBeSubmittedMessage.resources.push({
              thumbnail: '',
              original: encodeURI(
                '/resources' + realPathShouldBe.slice(realPathShouldBe.indexOf('/conversation/')).replace(/(\/\d{8}\/).*?\//, '$1')
              ),
              originalFilename: curr.originalname,
              mimetype: curr.mimetype,
              size: curr.size
            });
            acc.push(CommonImport.Promise.promisify(CommonImport.mkdirp)(realPathShouldBe.slice(0, realPathShouldBe.lastIndexOf('/') + 1)));
            moveFiles[curr.path] = realPathShouldBe;
            return acc;
          }, []);
        }

        return CommonImport.Promise.all(createNecessaryDirectories).return(moveFiles);

      }).then((moveFiles) => {
        const rename = CommonImport.Promise.promisify(require('fs').rename);
        const doMoveFilesAndSaveMessage = [];
        for (let currPath in moveFiles) {
          doMoveFilesAndSaveMessage.push(
            rename(currPath, moveFiles[currPath])
          );
        }
        doMoveFilesAndSaveMessage.unshift(
          CommonImport.utils.bluebirdRetryExecutor(() => {
            const chatGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.chat]);
            return new CommonImport.Promise((resolve, reject) => {
              return chatGrpcClient.checkQualificationAndSaveMessageV1(toBeSubmittedMessage, (err, data) => {
                if (err) {
                  return reject(err);
                }
                return resolve(data);
              });
            });
          }, {})
        );
        return CommonImport.Promise.all(doMoveFilesAndSaveMessage);
      }).then((data) => {
        /*
         * Orphan operation: publish to RabbitMQ.
         */
        RabbitMQ.publishMessageToRabbitMQ(data[0], toBeSubmittedMessage, {
          cid: req.user.cid,
          uid: req.user.uid,
          did: req.user.did
        });

        res.send(Object.assign(data[0], {
          conversationId: data[0].conversationId,
          resources: toBeSubmittedMessage.resources
        }));
      }).catch((err) => {
        next(err);
      });

    } else if (req.body.toConversationId) {

      if (Array.isArray(req.files)) {
        toBeSubmittedMessage.resources = req.files.reduce((acc, curr, idx) => {
          const tmp = {
            thumbnail: '',
            original: encodeURI(
              '/resources' + curr.path.slice(curr.path.indexOf('/conversation/')).replace(/(\/\d{8}\/).*?\//, '$1')
            ),
            originalFilename: curr.originalname,
            mimetype: curr.mimetype,
            size: curr.size
          };
          acc.push(tmp);
          return acc;
        }, toBeSubmittedMessage.resources || []);
      }

      CommonImport.utils.bluebirdRetryExecutor(() => {
        const chatGrpcClient = CommonImport.utils.pickRandomly(global.GRPC_CLIENTS[global.serviceTags.chat]);
        return new CommonImport.Promise((resolve, reject) => {
          return chatGrpcClient.checkQualificationAndSaveMessageV1(toBeSubmittedMessage, (err, data) => {
            if (err) {
              return reject(err);
            }
            return resolve(data);
          });
        });
      }, {}).then((data) => {

        /*
         * Orphan operation: publish to RabbitMQ.
         */
        RabbitMQ.publishMessageToRabbitMQ(data, toBeSubmittedMessage, Object.assign(data.aux || {}, {
          cid: req.user.cid,
          uid: req.user.uid,
          did: req.user.did
        }));

        res.send(Object.assign(data, {
          resources: toBeSubmittedMessage.resources
        }));

      }).catch((err) => {
        next(err);
      });
      
    } else {
      next(new CommonImport.errors.UncategorizedError.InvalidRequest());
    }

  }

}

module.exports = SendMessage;


