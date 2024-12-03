const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

exports.getReport = onCall(async (req) => {
  const {authId, iataTimeZone} = req.data;
  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!iataTimeZone) {
    throw new HttpsError("invalid-argument", "iataTimeZone is required");
  }

  const bmi = await getBmi(authId);
  const averageWater = await getAverageWaterWeek(authId, iataTimeZone);
  const averageCalories = await getAverageCaloriesWeek(authId, iataTimeZone);
  const dailyIntakes = await getDailyIntakes(authId, iataTimeZone);
  const dailyExerciseMinutes = await getDailyExerciseMinutes(
      authId, iataTimeZone,
  );

  const report = {
    bmi,
    averageWater,
    averageCalories,
    dailyIntakes,
    dailyExerciseMinutes,
  };
  return report;
});

const getBmi = async (authId) => {
  const userInfo = await db.collection("UserV2").doc(authId).get();

  if (!userInfo.exists) {
    throw new HttpsError(
        "failed-precondition",
        "Please complete your physical information in profile settings.",
    );
  }

  const {weight, height} = userInfo.data();
  const heightM = height / 100;
  return weight / (heightM * heightM);
};

const getAverageWaterWeek = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);

  // Fetch WaterLog documents for the past week for the specified user
  const userWaterLogs = await db.collection("WaterLogs")
      .where("authId", "==", authId)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      .get();

  // Check if there are no water logs
  if (userWaterLogs.empty) {
    return 0;
  }

  // Extract the water amounts from the logs
  const waterAmounts = userWaterLogs.docs.map((doc) => doc.data().amount);

  // Check if there is no water data in any of the logs
  if (waterAmounts.length === 0) {
    return 0;
  }

  // Calculate the average water intake
  const totalWater = waterAmounts.reduce((acc, cur) => acc + cur, 0);
  const averageWater = totalWater / waterAmounts.length;

  return averageWater;
};

const getAverageCaloriesWeek = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);

  // Fetch FoodLog documents for the past week for the specified user
  const userFoodLogs = await db.collection("FoodLog")
      .where("authId", "==", authId)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      .get();

  // Check if there are no food logs
  if (userFoodLogs.empty) {
    return 0;
  }

  // Group the logs by day in the specified time zone
  const dailyCaloriesMap = {};
  userFoodLogs.docs.forEach((doc) => {
    const {createdAt, calories} = doc.data();
    const dateInUserTimeZone = dayjs(createdAt.toDate()).tz(iataTimeZone);
    const dayString = dateInUserTimeZone.format("YYYY-MM-DD");

    // Add the calories to the corresponding day
    if (!dailyCaloriesMap[dayString]) {
      dailyCaloriesMap[dayString] = 0;
    }
    dailyCaloriesMap[dayString] += calories;
  });

  // Calculate the average daily calories
  const dailyCaloriesArray = Object.values(dailyCaloriesMap);
  const totalCalories = dailyCaloriesArray.reduce((acc, cur) => acc + cur, 0);
  const averageDailyCalories = totalCalories / dailyCaloriesArray.length;

  return averageDailyCalories;
};

const getDailyIntakes = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);
  // Convert the oneWeekAgo timestamp to a dayjs object
  const oneWeekAgo = dayjs(oneWeekAgoTimestamp.toDate()).tz(iataTimeZone);

  // Fetch FoodLog documents for the past week for the specified user
  const userFoodLogs = await db.collection("FoodLog")
      .where("authId", "==", authId)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      .get();

  // Init arrays of total food intake for each of the past 7 days
  const dailyCalories = Array(7).fill(0);
  const dailyCarbs = Array(7).fill(0);
  const dailyFat = Array(7).fill(0);
  const dailyProtein = Array(7).fill(0);

  // Group the logs by day and calculate total food intake
  userFoodLogs.docs.forEach((doc) => {
    const {
      createdAt,
      calories = 0,
      carbs = 0,
      fat = 0,
      protein = 0,
    } = doc.data();
    const dateInUserTimeZone = dayjs(createdAt.toDate()).tz(iataTimeZone);
    const dayIndex = dateInUserTimeZone.diff(oneWeekAgo, "days");
    dailyCalories[dayIndex] += calories;
    dailyCarbs[dayIndex] += carbs;
    dailyFat[dayIndex] += fat;
    dailyProtein[dayIndex] += protein;
  });

  return {dailyCalories, dailyCarbs, dailyFat, dailyProtein};
};

const getDailyExerciseMinutes = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);
  // Convert the oneWeekAgo timestamp to a dayjs object
  const oneWeekAgo = dayjs(oneWeekAgoTimestamp.toDate()).tz(iataTimeZone);

  // Fetch ExerciseLog documents for the past week for the specified user
  const userExerciseLogs = await db.collection("ExerciseLogs")
      .where("authId", "==", authId)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      .get();

  // Init an array of total exercise minutes for each of the past 7 days
  const dailyExerciseMinutes = Array(7).fill(0);

  // Group the logs by day and calculate total exercise time
  userExerciseLogs.docs.forEach((doc) => {
    const {createdAt, duration = 0} = doc.data();
    const dateInUserTimeZone = dayjs(createdAt.toDate()).tz(iataTimeZone);
    const dayIndex = dateInUserTimeZone.diff(oneWeekAgo, "days");

    if (dayIndex >= 0 && dayIndex < 7) {
      // Accumulate the total exercise minutes for the day
      dailyExerciseMinutes[dayIndex] += duration;
    }
  });

  return dailyExerciseMinutes;
};

const getOneWeekAgoTimestamp = (iataTimeZone) => {
  // Calculate one week ago at the start of the day in the specified time zone
  const oneWeekAgo = dayjs()
      .tz(iataTimeZone)
      .startOf("day")
      .subtract(6, "days");

  // Convert to Firestore Timestamp
  return Timestamp.fromDate(oneWeekAgo.toDate());
};
