const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");

/**
 * Returns a string summarizing a user's physical information.
 * @param {string} authId the user's authentication ID
 * @return {string} a string summarizing the user's physical information
 */
exports.getUserPhysicalPrompt = async function(authId) {
  const userPhysicalDoc = await db.collection("UserV2").doc(authId).get();

  if (!userPhysicalDoc.exists) {
    throw new Error("User info not found");
  }

  const userPhysicalData = userPhysicalDoc.data();

  return `Weight: ${userPhysicalData.weight}kg\n` +
      `Height: ${userPhysicalData.height}cm\n` +
      `Gender: ${userPhysicalData.gender}\n` +
      `Medicine: ${userPhysicalData.medicine}\n` +
      `Activity levels: ${userPhysicalData.activityLevels}`;
};

/**
   * Returns a string summarizing a user's target.
   * @param {string} authId the user's authentication ID
   * @return {string} a string summarizing the user's target
   */
exports.getUserTargetPrompt = async function(authId) {
  const userTarget = await db.collection("UserTargets")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userTarget && userTarget.docs.length <= 0) {
    throw new Error("UserTarget not found");
  }

  return `Target Weight: ${userTarget.docs[0].data().weight}kg\n` +
    `Duration: ${userTarget.docs[0].data().duration} weeks`;
};

/**
   * Returns a string summarizing a user's food logs for the past 7 days.
   * @param {string} authId the user's authentication ID
   * @return {string} a string summarizing the user's food for the past 7 days
   */
exports.getFoodLogsPrompt = async function(authId) {
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
    throw new Error("Need at least 1 food log for the past week");
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
};

/**
   * Returns a prompt for the 7-day exercise log for the given user
   * @param {string} authId - The user's authentication ID.
   * @return {Promise<string>} A promise that resolves to the prompt for the
   *                           exercise log.
   */
exports.getExerciseLogsPrompt = async function(authId) {
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
};

/**
   * Returns a string summarizing a user's water logs for the past 7 days.
   * @param {string} authId - The user's authentication ID.
   * @return {Promise<string>} A promise that resolves to the prompt for the
   *                           water log.
   */
exports.getWaterLogsPrompt = async function(authId) {
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
};
