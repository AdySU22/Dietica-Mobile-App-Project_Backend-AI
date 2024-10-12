const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../core/firestore");
const {model} = require("../core/model");
const logger = require("firebase-functions/logger");

exports.getChatbot = onCall(async () => {
  // TODO enable auth
  // if (!request.auth) {
  //   throw new HttpsError("unauthenticated", "User not authenticated");
  // }

  // TODO where authId
  const chatLogs = await db.collection("UserChatLog")
      .orderBy("repliedAt", "desc")
      .limit(5)
      .get();
  if (chatLogs) {
    chatLogs.forEach((chatLog) => {
      logger.info(chatLog.data());
    });
  }

  return chatLogs.docs.map((chatLog) => ({
    message: chatLog.data().message,
    reply: chatLog.data().reply,
    repliedAt: chatLog.data().repliedAt,
  }));
});

exports.sendChatbot = onCall(async (request) => {
  const message = request.data.message;

  if (!message || typeof message !== "string") {
    throw new HttpsError("invalid-argument", "message must not empty");
  }

  // TODO enable auth
  // if (!request.auth) {
  //   throw new HttpsError("unauthenticated", "User not authenticated");
  // }

  // TODO where authId
  const chatLogs = await db.collection("UserChatLog")
      .orderBy("repliedAt", "desc")
      .limit(5)
      .get();
  if (chatLogs) {
    chatLogs.forEach((chatLog) => {
      logger.info(chatLog.data());
    });
  }

  const chat = await model.startChat(
      {
        history: chatLogs.docs.reduce((total, chatLog) => {
          total.push(
              {
                role: "user",
                parts: [{text: chatLog.data().message}],
              },
              {
                role: "model",
                parts: [{text: chatLog.data().reply}],
              },
          );
          return total;
        }, []),
      },
  );

  const reply = await chat.sendMessage(message);

  // TODO add authId
  await db.collection("UserChatLog").add({
    message: message,
    reply: reply.response.text(),
    repliedAt: new Date(),
  });

  return reply.response.text();
});
