const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");
const {model, modelTodo} = require("../core/model");
const logger = require("firebase-functions/logger");

const PromisePool = require("es6-promise-pool");

exports.getTodo = onCall(async (request) => {
  const {authId} = request.data;

  if (!authId) {
    throw new HttpsError("unauthenticated", "authId is required");
  }

  const todo = await db.collection("UserTodo")
      .where("authId", "==", authId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
  if (todo && todo.docs.length <= 0) {
    throw new HttpsError("not-found", "Todo not found");
  }

  return {
    todo: todo.docs[0].data().todo,
    createdAt: todo.docs[0].data().createdAt,
  };
});

exports.getTodoV2 = onCall(async (request) => {
  const {authId} = request.data;

  if (!authId) {
    throw new HttpsError("unauthenticated", "authId is required");
  }

  const todo = await db.collection("UserTodo")
      .where("authId", "==", authId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
  if (todo && todo.docs.length <= 0) {
    throw new HttpsError("not-found", "Todo not found");
  }

  return {
    todoV2: todo.docs[0].data().todoV2,
    createdAt: todo.docs[0].data().createdAt,
  };
});

exports.generateTodoV2 = onCall(async (request) => {
  const {authId} = request.data;

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
  await db.collection("UserTodo").add({
    authId: authId,
    todoV2: JSON.parse(reply.response.text()),
    createdAt: new Date(),
  });

  return JSON.parse(reply.response.text());
});

exports.generateTodo = onSchedule("0 23 * * *", async (event) => {
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
          await processUserTodo(userToken.authId, userToken.token);
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
    message: `Generated Todo for ${countSuccess} users`,
  };
});

/**
 * @function processUserTodo
 * @description Process a user's information and generate a personalized Todo
 *              recommendation based on their physical information, target, and
 *              exercise, food, and water logs.
 * @param {string} authId - The user's authentication ID.
 * @param {string} token - The user's Firebase token.
 * @return {Promise<string>} A promise that resolves to the generated Todo
 *                           recommendation.
 */
async function processUserTodo(authId, token) {
  // Generate ToDo
  const message = await getMessagePrompt(authId);
  const reply = await model.generateContent(message);
  logger.info({
    message: "generateTodo",
    data: {
      message: message,
      reply: reply.response.text(),
    },
  });

  // Save generated ToDo
  await db.collection("UserTodo").add({
    authId: authId,
    todo: reply.response.text(),
    createdAt: new Date(),
  });

  // Send notification
  try {
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
    logger.log(`Sent notification for ${authId}`);
  } catch (e) {
    logger.error(`Failed to send notification for ${authId}`, e);
  }

  return reply.response.text();
}

/**
 * @function getMessagePrompt
 * @description Returns a string summarizing a user's physical information and
 *              their logs over the last 7 days, as well as a task to generate
 *              a personalized recommendation for the user.
 * @param {string} authId - The user's authentication ID.
 * @return {Promise<string>} A promise that resolves to the message prompt.
 */
async function getMessagePrompt(authId) {
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
      `Task: Using this data, generate personalized recommendations under three categories: Food, Exercise, and Water. Each category should have:\n` +
      // eslint-disable-next-line max-len
      `Title: A short, encouraging or informative title (e.g., "Increase Your Protein Intake!" or "Great Job on Cardio!")\n` +
      // eslint-disable-next-line max-len
      `Description: A short, personalized description or explanation based on the user's behavior over the last 7 days. This should highlight what they are doing well and areas for improvement.`;
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
  const userPhysical = await db.collection("UserPhysical")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userPhysical && userPhysical.docs.length <= 0) {
    throw new Error("UserPhysical not found");
  }

  return `Weight: ${userPhysical.docs[0].data().weight}kg\n` +
      `Height: ${userPhysical.docs[0].data().height}cm\n` +
      `Gender: ${userPhysical.docs[0].data().gender}\n` +
      `Medicine: ${userPhysical.docs[0].data().medicine}\n` +
      // eslint-disable-next-line max-len
      `Average Activity Per Week: ${userPhysical.docs[0].data().activityHours} hours`;
}

/**
 * Returns a string summarizing a user's target.
 * @param {string} authId the user's authentication ID
 * @return {string} a string summarizing the user's target
 */
async function getUserTargetPrompt(authId) {
  const userTarget = await db.collection("UserTarget")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userTarget && userTarget.docs.length <= 0) {
    throw new Error("UserTarget not found");
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
  if (foodLogs.size < 3) {
    throw new Error("Need at least 3 food logs for the past week");
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
      summary[summary.length - 1].cholestrol += foodData.cholestrol;
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
        cholestrol: foodData.cholestrol,
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
        `Cholesterol: ${foodLog.cholestrol}mg; ` +
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
      const cardio = exerciseLog.data().cardio;
      const weightLifting = exerciseLog.data().weightLifting;

      return `Date: ${date.getDate()} ${date.getMonth() + 1}\n` +
          `Cardio: ${cardio} hours; ` +
          `Weight Lifting: ${weightLifting} hours`;
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
    return waterLogs.docs.map((waterLog) => {
      const date = waterLog.data().createdAt.toDate();

      return `Date: ${date.getDate()} ${date.getMonth() + 1}\n` +
          `Water: ${waterLog.data().amount} ml`;
    }).join("\n");
  }
}
