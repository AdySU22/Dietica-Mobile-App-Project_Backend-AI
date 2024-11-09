const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");
const logger = require("firebase-functions/logger");
const PromisePool = require("es6-promise-pool");

const MAX_CONCURRENT = 10;

exports.notifyFood = onSchedule("0 23 * * *", async (event) => {
  const activeUserTokensSnapshot = await db.collection("UserToken")
      .where("updatedAt", ">", Timestamp.fromMillis(
          Date.now() - 3 * 24 * 60 * 60 * 1000,
      ))
      .orderBy("updatedAt", "desc")
      .get();
  const activeUserTokens = activeUserTokensSnapshot.docs
      .map((doc) => doc.data());

  let countSuccess = 0;
  // eslint-disable-next-line require-jsdoc
  function* generatePromises() {
    for (const userToken of activeUserTokens) {
      yield (async () => {
        try {
          await notify(
              userToken.authId,
              userToken.token,
              "Don't forget to input your food!",
              "We need the data to help you!",
          );
          countSuccess++;
        } catch (error) {
          logger.debug("Error processing user todo:", error.message);
        }
      })();
    }
  }

  const promisePool = new PromisePool(
      generatePromises(),
      MAX_CONCURRENT, // limit concurrent process to reduce server load
  );
  await promisePool.start();

  return {
    message: `Sent food notification for ${countSuccess} users`,
  };
});

exports.notifyExercise = onSchedule("0 5 * * *", async (event) => {
  const activeUserTokensSnapshot = await db.collection("UserToken")
      .where("updatedAt", ">", Timestamp.fromMillis(
          Date.now() - 3 * 24 * 60 * 60 * 1000,
      ))
      .orderBy("updatedAt", "desc")
      .get();
  const activeUserTokens = activeUserTokensSnapshot.docs
      .map((doc) => doc.data());

  let countSuccess = 0;
  // eslint-disable-next-line require-jsdoc
  function* generatePromises() {
    for (const userToken of activeUserTokens) {
      yield (async () => {
        try {
          await notify(
              userToken.authId,
              userToken.token,
              "Do your daily routine!",
              "Remember to log your exercise activities!",
          );
          countSuccess++;
        } catch (error) {
          logger.debug("Error processing user todo:", error.message);
        }
      })();
    }
  }

  const promisePool = new PromisePool(
      generatePromises(),
      MAX_CONCURRENT, // limit concurrent process to reduce server load
  );
  await promisePool.start();

  return {
    message: `Sent exercise notification for ${countSuccess} users`,
  };
});

exports.notifyWater = onSchedule("0 12 * * *", async (event) => {
  const activeUserTokensSnapshot = await db.collection("UserToken")
      .where("updatedAt", ">", Timestamp.fromMillis(
          Date.now() - 3 * 24 * 60 * 60 * 1000,
      ))
      .orderBy("updatedAt", "desc")
      .get();
  const activeUserTokens = activeUserTokensSnapshot.docs
      .map((doc) => doc.data());

  let countSuccess = 0;
  // eslint-disable-next-line require-jsdoc
  function* generatePromises() {
    for (const userToken of activeUserTokens) {
      yield (async () => {
        try {
          await notify(
              userToken.authId,
              userToken.token,
              "Hey, don't forget to drink water today!",
              "Your body is 70% water, so make sure to hydrate!",
          );
          countSuccess++;
        } catch (error) {
          logger.debug("Error processing user todo:", error.message);
        }
      })();
    }
  }

  const promisePool = new PromisePool(
      generatePromises(),
      MAX_CONCURRENT, // limit concurrent process to reduce server load
  );
  await promisePool.start();

  return {
    message: `Sent water notification for ${countSuccess} users`,
  };
});

/**
 * Send a notification to a user's device
 * @param {string} authId - The user's authentication ID.
 * @param {string} token - The user's Firebase token.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body of the notification.
 */
async function notify(authId, token, title, body) {
  try {
    const notificationMessage = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      android: {
        notification: {
          sound: "default",
        },
      },
    };
    await admin.messaging().send(notificationMessage);
    logger.log(`Sent notification for ${authId}`);
  } catch (e) {
    logger.error(`Failed to send notification for ${authId}`, e);
  }
}
