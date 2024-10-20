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
  const dailyExerciseMinutes = await getDailyExerciseMinutes(
      authId, iataTimeZone,
  );

  const report = {
    bmi,
    averageWater,
    averageCalories,
    dailyExerciseMinutes,
  };
  return report;
});

const getBmi = async (authId) => {
  const userPhysical = await db.collection("UserPhysical")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userPhysical && userPhysical.docs.length <= 0) {
    throw new HttpsError("not-found", "UserPhysical not found");
  }

  const {weight, height} = userPhysical.docs[0].data();
  const heightM = height / 100;
  return weight / (heightM * heightM);
};

const getAverageWaterWeek = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);

  // Fetch WaterLog documents for the past week for the specified user
  const userWaterLogs = await db.collection("WaterLog")
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
    throw new HttpsError("internal", "No water log found with water data");
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

const getDailyExerciseMinutes = async (authId, iataTimeZone) => {
  // Get one week ago timestamp
  const oneWeekAgoTimestamp = getOneWeekAgoTimestamp(iataTimeZone);
  // Convert the oneWeekAgo timestamp to a dayjs object
  const oneWeekAgo = dayjs(oneWeekAgoTimestamp.toDate()).tz(iataTimeZone);

  // Fetch ExerciseLog documents for the past week for the specified user
  const userExerciseLogs = await db.collection("ExerciseLog")
      .where("authId", "==", authId)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      .get();

  // Init an array of total exercise minutes for each of the past 7 days
  const dailyExerciseMinutes = Array(7).fill(0);

  // Group the logs by day and calculate total exercise time
  userExerciseLogs.docs.forEach((doc) => {
    const {createdAt, cardio = 0, weightLifting = 0} = doc.data();
    const dateInUserTimeZone = dayjs(createdAt.toDate()).tz(iataTimeZone);
    const dayIndex = dateInUserTimeZone.diff(oneWeekAgo, "days");

    if (dayIndex >= 0 && dayIndex < 7) {
      // Accumulate the total exercise minutes for the day
      dailyExerciseMinutes[dayIndex] += cardio + weightLifting;
    }
  });

  return dailyExerciseMinutes;
};

const getOneWeekAgoTimestamp = (iataTimeZone) => {
  // Calculate one week ago at the start of the day in the specified time zone
  const oneWeekAgo = dayjs()
      .tz(iataTimeZone)
      .startOf("day")
      .subtract(7, "days");

  // Convert to Firestore Timestamp
  return Timestamp.fromDate(oneWeekAgo.toDate());
};
