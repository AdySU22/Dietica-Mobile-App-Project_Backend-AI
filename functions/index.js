const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {getChatbot, sendChatbot} = require("./services/chatbot");

exports.helloWorld = onCall((request) => {
  logger.info("Hello logs!", {structuredData: true});
  return "Hello from Firebase!";
});

exports.getChatbot = getChatbot;
exports.sendChatbot = sendChatbot;
