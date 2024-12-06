const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");
const {modelTodo} = require("../core/model");
const {getBmi} = require("../core/buildUserData");
const logger = require("firebase-functions/logger");

const PromisePool = require("es6-promise-pool");

exports.getTodoV2 = onCall(async (request) => {
  const {authId} = request.data;

  if (!authId) {
    throw new HttpsError("unauthenticated", "authId is required");
  }

  const todo = await db.collection("UserTodoV2")
      .where("authId", "==", authId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

  // If no todo found, generate a new one
  if (todo && todo.docs.length <= 0) {
    return await processUserTodoV2(authId);
  }

  const data = todo.docs[0].data();
  // Check if data.createdAt exists and is older than 1 day
  if (data.createdAt && data.createdAt._seconds) {
    const createdAtDate = new Date(data.createdAt._seconds * 1000);
    const currentDate = new Date();

    const differenceInMs = currentDate - createdAtDate;
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // More than 1 day
    if (differenceInMs > oneDayInMs) {
      // Generate a new Todo and return it
      return await processUserTodoV2(authId);
    }
  }

  return data;
});

exports.generateTodoScheduleV2 = onSchedule("0 23 * * *", async (event) => {
  const activeUserTokensSnapshot = await db.collection("UserToken")
      .where("updatedAt", ">", Timestamp.fromMillis(
          Date.now() - 3 * 24 * 60 * 60 * 1000,
      ))
      .orderBy("updatedAt", "desc")
      .limit(10) // TODO AI limit 15 requests per minute
      .get();
  const activeUserTokens = activeUserTokensSnapshot.docs
      .map((doc) => doc.data());

  let countSuccess = 0;
  // eslint-disable-next-line require-jsdoc
  function* generatePromises() {
    for (const userToken of activeUserTokens) {
      yield (async () => {
        try {
          await processUserTodoV2(userToken.authId, userToken.token);
          countSuccess++;
        } catch (error) {
          logger.debug("Error processing user todo:", error.message);
        }
      })();
    }
  }

  const promisePool = new PromisePool(
      generatePromises(),
      3, // limit concurrent process to reduce server load
  );
  await promisePool.start();

  return {
    message: `Generated TodoV2 for ${countSuccess} users`,
  };
});

exports.generateTodoV2 = onCall(async (request) => {
  const {authId} = request.data;
  if (typeof authId !== "string") {
    throw new HttpsError("unauthenticated", "authId is required");
  }

  return await processUserTodoV2(authId, null);
});

/**
 * Generates a To Do list for the given user and sends a notification to
 * the given FCM token.
 *
 * @param {string} authId - The auth ID of the user
 * @param {string} token - The FCM token to send the notification to
 * @return {Promise<object>} A promise that resolves to the generated
 *     To Do list data
 * @throws {HttpsError} If the authId is invalid or not provided
 * @throws {Error} If there is an error generating the To Do list or
 *     sending the notification
 */
async function processUserTodoV2(authId, token) {
  if (typeof authId !== "string") {
    throw new HttpsError("unauthenticated", "authId is required");
  }

  // Generate ToDo
  const message = await getMessagePromptV2(authId);
  const reply = await modelTodo.generateContent(message);
  logger.info({
    message: "generateTodo",
    data: {
      message: message,
      reply: reply.response.text(),
    },
  });

  // Save generated ToDo
  const responseJson = JSON.parse(reply.response.text());
  const data = {
    authId: authId,
    foodTitle: responseJson.food.title,
    foodDescription: responseJson.food.description,
    exerciseTitle: responseJson.exercise.title,
    exerciseDescription: responseJson.exercise.description,
    waterTitle: responseJson.water.title,
    waterDescription: responseJson.water.description,
    createdAt: new Date(),
  };
  await db.collection("UserTodoV2").add(data);

  // Send notification
  if (token != null) {
    const notificationMessage = {
      token: token,
      notification: {
        title: "Here's your To Do list for today",
        body: "Keep your body healthy and happy today!",
      },
      android: {
        notification: {
          sound: "default",
        },
      },
    };
    await admin.messaging().send(notificationMessage);
  }

  return data;
}

/**
 * V2: Builds a summary prompt of a user's physical data, goals, and weekly logs
 * for personalized Food, Exercise, and Water advice.
 * @param {string} authId - User's authentication ID.
 * @return {Promise<string>} Resolves to the recommendation prompt.
 */
async function getMessagePromptV2(authId) {
  const userPhysicalPrompt = await getUserPhysicalPrompt(authId);
  const userTargetPrompt = await getUserTargetPrompt(authId);
  const foodLogsSummaryPrompt = await getFoodLogsPrompt(authId);
  const exerciseLogsSummaryPrompt = await getExerciseLogsPrompt(authId);
  const waterLogsSummaryPrompt = await getWaterLogsPrompt(authId);

  // eslint-disable-next-line max-len
  return `Based on these user's information, provide a personalized recommendation focusing on three main topics: Food, Exercise, and Water.\n\n` +
      `User Physical\n${userPhysicalPrompt}\n\n` +
      `User Target\n${userTargetPrompt}\n\n` +
      `Food Log (7-day history)\n${foodLogsSummaryPrompt}\n\n` +
      `Water Log (7-day history)\n${waterLogsSummaryPrompt}\n\n` +
      `Exercise Log (7-day history)\n${exerciseLogsSummaryPrompt}\n\n` +
      // eslint-disable-next-line max-len
      `Task: Generate personalized recommendations under three categories: Food, Exercise, and Water.\n` +
      `Please keep it short and concise.\n` +
      `\n` +
      `Food description format (adjust based on user data):\n` +
      `Today Target Calories: // example: 1800 kcal\n` +
      `Carbs: // example: 300 g\n` +
      `Protein: // example: 60 g\n` +
      `Fat: // example: 50 g\n` +
      `Sugar: // example: 50 g\n` +
      `\n` +
      `Exercise description format (adjust based on user data):\n` +
      `This Week Target Cardio: // example: 2 more sessions\n` +
      `Weightlifting: // example: 1 more session\n` +
      `Yoga: // example: Congratulations, you have done enough!\n` +
      `\n` +
      `Water description format (adjust based on user data):\n` +
      `// example: Drink another 5 glasses of water today`;
}

/**
 * Returns a string summarizing a user's physical information.
 * @param {string} authId the user's authentication ID
 * @return {string} a string summarizing the user's physical information
 */
async function getUserPhysicalPrompt(authId) {
  const userPhysicalDoc = await db.collection("UserV2").doc(authId).get();

  if (!userPhysicalDoc.exists) {
    throw new HttpsError(
        "failed-precondition",
        "Please complete your physical information in profile",
    );
  }

  const userPhysicalData = userPhysicalDoc.data();

  return `Name: ${userPhysicalData.firstName} ${userPhysicalData.lastName}\n` +
    `Weight: ${userPhysicalData.weight}kg\n` +
    `Height: ${userPhysicalData.height}cm\n` +
    `BMI: ${
      getBmi(userPhysicalData.weight, userPhysicalData.height / 100).value
    }\n` +
    `Gender: ${userPhysicalData.gender}\n` +
    `Medicine: ${userPhysicalData.medicine}\n` +
    `Activity levels: ${userPhysicalData.activityLevels}`;
}

/**
 * Returns a string summarizing a user's target.
 * @param {string} authId the user's authentication ID
 * @return {string} a string summarizing the user's target
 */
async function getUserTargetPrompt(authId) {
  const userTarget = await db.collection("UserTargets")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userTarget && userTarget.docs.length <= 0) {
    throw new HttpsError(
        "failed-precondition",
        "Please complete your weight target and duration",
    );
  }

  return `Target Weight: ${userTarget.docs[0].data().weight}kg\n` +
  `Duration: ${userTarget.docs[0].data().duration} weeks`;
}

/**
 * Returns a string summarizing a user's food logs for the past 7 days.
 * @param {string} authId the user's authentication ID
 * @return {string} a string summarizing the user's food for the past 7 days
 */
async function getFoodLogsPrompt(authId) {
  const foodLogs = await db.collection("FoodLog")
      .where("authId", "==", authId)
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .limit(50)
      .get();
  if (foodLogs.size < 1) {
    throw new HttpsError(
        "failed-precondition",
        "Please input at least 1 food log for the past week",
    );
  }

  const foodSummary = foodLogs.docs.reduce((summary, foodLog) => {
    const foodData = foodLog.data();
    const currentLogDate = foodData.createdAt.toDate().getDate();
    const lastLogDate = summary.length > 0 ?
        summary[summary.length - 1].createdAt.toDate().getDate() :
        null;

    if (summary.length > 0 && currentLogDate === lastLogDate) {
      summary[summary.length - 1].calories += foodData.calories;
      summary[summary.length - 1].fat += foodData.fat;
      summary[summary.length - 1].saturatedFat += foodData.saturatedFat;
      summary[summary.length - 1].unsaturatedFat += foodData.unsaturatedFat;
      summary[summary.length - 1].transFat += foodData.transFat;
      summary[summary.length - 1].cholesterol += foodData.cholesterol;
      summary[summary.length - 1].sodium += foodData.sodium;
      summary[summary.length - 1].carbs += foodData.carbs;
      summary[summary.length - 1].protein += foodData.protein;
      summary[summary.length - 1].sugar += foodData.sugar;
      summary[summary.length - 1].fiber += foodData.fiber;
    } else {
      summary.push({
        createdAt: foodData.createdAt,
        calories: foodData.calories,
        fat: foodData.fat,
        saturatedFat: foodData.saturatedFat,
        unsaturatedFat: foodData.unsaturatedFat,
        transFat: foodData.transFat,
        cholesterol: foodData.cholesterol,
        sodium: foodData.sodium,
        carbs: foodData.carbs,
        protein: foodData.protein,
        sugar: foodData.sugar,
        fiber: foodData.fiber,
      });
    }
    return summary;
  }, []);

  return foodSummary.map((foodLog) => {
    const date = foodLog.createdAt.toDate();
    return `Date: ${date.getDate()} ${date.getMonth() + 1}\n` +
        `Calories: ${foodLog.calories}; ` +
        `Fat: ${foodLog.fat}g; ` +
        `Saturated Fat: ${foodLog.saturatedFat}g; ` +
        `Unsaturated Fat: ${foodLog.unsaturatedFat}g; ` +
        `Trans Fat: ${foodLog.transFat}g; ` +
        `Cholesterol: ${foodLog.cholesterol}mg; ` +
        `Sodium: ${foodLog.sodium}mg; ` +
        `Carbs: ${foodLog.carbs}g; ` +
        `Protein: ${foodLog.protein}g; ` +
        `Sugar: ${foodLog.sugar}g; ` +
        `Fiber: ${foodLog.fiber}g`;
  }).join("\n");
}

/**
 * Returns a prompt for the 7-day exercise log for the given user
 * @param {string} authId - The user's authentication ID.
 * @return {Promise<string>} A promise that resolves to the prompt for the
 *                           exercise log.
 */
async function getExerciseLogsPrompt(authId) {
  const exerciseLogs = await db.collection("ExerciseLog")
      .where("authId", "==", authId)
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .limit(50)
      .get();

  if (exerciseLogs.empty) {
    return "No exercise logs found for the past week\n";
  } else {
    return exerciseLogs.docs.map((exerciseLog) => {
      const date = exerciseLog.data().createdAt.toDate();
      const {name, duration} = exerciseLog.data();

      // eslint-disable-next-line max-len
      return `${date.getDate()} ${date.getMonth() + 1}: ${name} for ${duration} minutes`;
    }).join("\n");
  }
}

/**
 * Returns a string summarizing a user's water logs for the past 7 days.
 * @param {string} authId - The user's authentication ID.
 * @return {Promise<string>} A promise that resolves to the prompt for the
 *                           water log.
 */
async function getWaterLogsPrompt(authId) {
  const waterLogs = await db.collection("WaterLog")
      .where("authId", "==", authId)
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .get();

  if (waterLogs.empty) {
    return "No water logs found for the past week. " +
        "Assume normal water intake.\n";
  } else {
    // Aggregate WaterLog for each day
    const waterLogMap = new Map();
    waterLogs.docs.forEach((waterLog) => {
      const date = waterLog.data().createdAt.toDate();
      const dateString = `${date.getDate()} ${date.getMonth() + 1}`;
      const existingLog = waterLogMap.get(dateString);
      if (existingLog) {
        existingLog.total += waterLog.data().amount;
      } else {
        waterLogMap.set(dateString, {
          total: waterLog.data().amount,
        });
      }
    });

    const waterLogPrompts = [];
    waterLogMap.forEach((log, dateString) => {
      waterLogPrompts.push(`Date: ${dateString}\nWater: ${log.total} ml`);
    });

    return waterLogPrompts.join("\n");
  }
}
