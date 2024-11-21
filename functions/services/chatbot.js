/* eslint-disable max-len */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../core/firestore");
const {modelChatbot} = require("../core/model");
const logger = require("firebase-functions/logger");
const {
  getUserPhysicalPrompt,
  getUserTargetPrompt,
  getFoodLogsPrompt,
  getExerciseLogsPrompt,
  getWaterLogsPrompt,
} = require("../core/buildUserData");

exports.getChatbot = onCall(async (req) => {
  const {authId} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const chatLogs = await db.collection("UserChatLog")
      .where("authId", "==", authId)
      .where("repliedAt", ">", oneWeekAgo)
      .orderBy("repliedAt", "desc")
      .limit(10)
      .get();
  const reversedChatLogs = chatLogs.docs.slice().reverse();
  if (chatLogs) {
    logger.info({
      authId: authId,
      chat: reversedChatLogs.map((chatLog) => chatLog.data()),
    });
  }

  return reversedChatLogs.map((chatLog) => ({
    message: chatLog.data().message,
    reply: chatLog.data().reply,
    repliedAt: chatLog.data().repliedAt,
  }));
});

exports.sendChatbot = onCall(async (req) => {
  const {authId, message} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!message || typeof message !== "string") {
    throw new HttpsError("invalid-argument", "message must not empty");
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const chatLogs = await db.collection("UserChatLog")
      .where("authId", "==", authId)
      .where("repliedAt", ">", oneWeekAgo)
      .orderBy("repliedAt", "desc")
      .limit(10)
      .get();
  const reversedChatLogs = chatLogs.docs.slice().reverse();
  if (chatLogs) {
    logger.info({
      authId: authId,
      chat: reversedChatLogs.map((chatLog) => chatLog.data()),
    });
  }

  const chat = modelChatbot({
    systemInstruction: await buildSystemInstruction(authId),
  }).startChat(
      {
        history: reversedChatLogs.reduce((total, chatLog) => {
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

  await db.collection("UserChatLog").add({
    authId: authId,
    message: message,
    reply: reply.response.text(),
    repliedAt: new Date(),
  });

  return reply.response.text();
});

/**
 * Returns a system instruction string for a chatbot model.
 * The system instruction string is a string that contains information about
 * the user, such as their physical information, target, and logs over the last
 * 7 days.
 * @param {string} authId - The user's authentication ID.
 * @return {Promise<string>} A promise that resolves to the system instruction
 *                           string.
 */
async function buildSystemInstruction(authId) {
  const userPhysicalPrompt = await getUserPhysicalPrompt(authId);
  const userTargetPrompt = await getUserTargetPrompt(authId);
  const foodLogsSummaryPrompt = await getFoodLogsPrompt(authId);
  const exerciseLogsSummaryPrompt = await getExerciseLogsPrompt(authId);
  const waterLogsSummaryPrompt = await getWaterLogsPrompt(authId);

  return `You are a diet and exercise advisor in a nutrition tracking app.` +
      `Here are the user's information inputted in the app:\n\n` +
      `User Physical\n${userPhysicalPrompt}\n\n` +
      `User Target\n${userTargetPrompt}\n\n` +
      `Food Log (7-day history)\n${foodLogsSummaryPrompt}\n\n` +
      `Water Log (7-day history)\n${waterLogsSummaryPrompt}\n\n` +
      `Exercise Log (7-day history)\n${exerciseLogsSummaryPrompt}\n\n` +
      `Do not criticize the given info above. ` +
      `If there are not enough data, start with a general recommendation, then ask the user for more info. ` +
      `Do not ask for data that is hard to find or calculate.` +
      `If it was very specific, then do not ask for it, ` +
      `for example missing cholesterol or fiber and incomplete exercise logs.`;
}
