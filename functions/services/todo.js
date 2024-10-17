const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");
const {model} = require("../core/model");
const logger = require("firebase-functions/logger");

exports.getTodo = onCall(async () => {
  // TODO enable auth
  // if (!request.auth) {
  //   throw new HttpsError("unauthenticated", "User not authenticated");
  // }

  // TODO where authId
  const todo = await db.collection("UserTodo")
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

exports.generateTodo = onCall(async (request) => {
  // TODO enable auth
  // if (!request.auth) {
  //   throw new HttpsError("unauthenticated", "User not authenticated");
  // }

  // TODO where authId
  const userPhysical = await db.collection("UserPhysical")
      .limit(1)
      .get();
  if (userPhysical && userPhysical.docs.length <= 0) {
    throw new HttpsError("not-found", "UserPhysical not found");
  }

  // TODO where authId
  const userTarget = await db.collection("UserTarget")
      .limit(1)
      .get();
  if (userTarget && userTarget.docs.length <= 0) {
    throw new HttpsError("not-found", "UserTarget not found");
  }

  // TODO where authId
  const foodLogs = await db.collection("FoodLog")
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .limit(50)
      .get();

  // TODO where authId
  const exerciseLogs = await db.collection("ExerciseLog")
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .limit(50)
      .get();

  // TODO where authId
  const waterLogs = await db.collection("WaterLog")
      .where(
          "createdAt",
          ">",
          Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      .orderBy("createdAt")
      .get();

  const userPhysicalPrompt = getUserPhysicalPrompt(userPhysical);
  const userTargetPrompt = getUserTargetPrompt(userTarget);
  const foodLogsSummaryPrompt = getFoodLogsPrompt(foodLogs);
  const exerciseLogsSummaryPrompt = getExerciseLogsPrompt(exerciseLogs);
  const waterLogsSummaryPrompt = getWaterLogsPrompt(waterLogs);

  // eslint-disable-next-line max-len
  const message = `Based on these user's information, provide a personalized recommendation focusing on three main topics: Food, Exercise, and Water.\n\n` +
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

  const reply = await model.generateContent(message);
  logger.info("generateTodo message:", message);
  logger.info("generateTodo reply:", reply.response.text());

  // TODO add authId
  await db.collection("UserTodo").add({
    todo: reply.response.text(),
    createdAt: new Date(),
  });

  return reply.response.text();
});

/**
 * Returns a string summarizing a user's physical information.
 *
 * @param {firebase.firestore.QuerySnapshot} userPhysical a QuerySnapshot
 * containing the user's physical information
 * @return {string} a string summarizing the user's physical information
 */
function getUserPhysicalPrompt(userPhysical) {
  return `Weight: ${userPhysical.docs[0].data().weight}kg\n` +
      `Height: ${userPhysical.docs[0].data().height}cm\n` +
      `Gender: ${userPhysical.docs[0].data().gender}\n` +
      `Medicine: ${userPhysical.docs[0].data().medicine}\n` +
      // eslint-disable-next-line max-len
      `Average Activity Per Week: ${userPhysical.docs[0].data().activityHours} hours`;
}

/**
 * Returns a string summarizing a user's target information.
 *
 * The string includes the user's target weight and the duration of the
 * weight loss program.
 *
 * @param {firebase.firestore.QuerySnapshot} userTarget a QuerySnapshot
 * containing the user's target information
 * @return {string} a string summarizing the user's target information
 */
function getUserTargetPrompt(userTarget) {
  return `Target Weight: ${userTarget.docs[0].data().weight}kg\n` +
  `Duration: ${userTarget.docs[0].data().duration} weeks`;
}

/**
 * Returns a string summarizing a user's food log.
 *
 * The string includes the date, calories, carbs, protein, fats, and sugar
 * for each day of the week.
 *
 * @param {firebase.firestore.QuerySnapshot} foodLogs a QuerySnapshot
 * containing the user's food log
 * @return {string} a string summarizing the user's food log
 */
function getFoodLogsPrompt(foodLogs) {
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
 * Returns a string summarizing a user's exercise log.
 *
 * The string includes the dates of the exercises, the duration of cardio
 * exercises, and the duration of weight lifting exercises.
 *
 * @param {firebase.firestore.QuerySnapshot} exerciseLogs a QuerySnapshot
 * containing the user's exercise log
 * @return {string} a string summarizing the user's exercise log
 */
function getExerciseLogsPrompt(exerciseLogs) {
  return exerciseLogs.docs.map((exerciseLog) => {
    const date = exerciseLog.data().createdAt.toDate();
    const cardio = exerciseLog.data().cardio;
    const weightLifting = exerciseLog.data().weightLifting;

    return `Date: ${date.getDate()} ${date.getMonth() + 1}\n` +
        `Cardio: ${cardio} hours; ` +
        `Weight Lifting: ${weightLifting} hours`;
  }).join("\n");
}

/**
 * Returns a string summarizing a user's water log.
 *
 * The string includes the dates and the amount of water consumed.
 *
 * @param {firebase.firestore.QuerySnapshot} waterLogs a QuerySnapshot
 * containing the user's water log
 * @return {string} a string summarizing the user's water log
 */
function getWaterLogsPrompt(waterLogs) {
  return waterLogs.docs.map((waterLog) => {
    const date = waterLog.data().createdAt.toDate();

    return `Date: ${date.getDate()} ${date.getMonth() + 1}\n` +
        `Water: ${waterLog.data().amount} ml`;
  }).join("\n");
}
