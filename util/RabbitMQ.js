'use strict';

const os = require('os');

const CommonImport = require('./CommonImport');

class RabbitMQ {

  static publishMessageToRabbitMQ(serverRes, receivedMessage, aux) {
    
    const toBePublishedData = this._constructMessageToBePublishedToRabbitMQ(serverRes, receivedMessage, aux);

    this._publish(
      global.RabbitMQ.settings.exchanges['gate-ex-to-ws'].name,
      global.RabbitMQ.settings.exchanges['gate-ex-to-ws'].binds.forTextMessage.routingKey,
      toBePublishedData
    ).then((publishRes) => {
      // Anything need to be done here?
    }).catch((err) => {
      // TODO: failed to publish, should do something here.
    });

  }

  static _constructMessageToBePublishedToRabbitMQ(serverRes, receivedMessage, aux) {
    const toBePublishedData = {
      message: {
        messageId: serverRes.messageId,
        messageType: receivedMessage.messageType,
        content: receivedMessage.content,
        resources: receivedMessage.resources,
        toConversationId: receivedMessage.toConversationId,
        conversationType: receivedMessage.conversationType,
        forGroupId: receivedMessage.forGroupId,
        mentionedUserUserIds: serverRes.mentionedUserUserIds,
        mentionedMessages: serverRes.mentionedMessages,
      },
      targetUsers: serverRes.targetUsers,
      aux: aux
    };
    CommonImport.utils.cleanup(toBePublishedData);
    return toBePublishedData;
  }

  static _publish(exchange, routingKey, content) {
    return CommonImport.utils.bluebirdRetryExecutor(() => {
      return CommonImport.utils.pickRandomly(global.RabbitMQ.channels).publish(
        exchange,
        routingKey,
        new Buffer(JSON.stringify(content)),
        {
          persistent: false,
          mandatory: true,
          headers: {
            publisher: os.hostname()
          }
        }
      );
    }, {});
  }

}

module.exports = RabbitMQ;


