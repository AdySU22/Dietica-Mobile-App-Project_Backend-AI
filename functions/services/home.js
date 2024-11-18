const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

exports.homeFoodTodaySummary = onCall(async (req) => {
  // userTimeZone should be a valid IANA time zone name
  const {authId, iataTimeZone} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }

  // Get the current and next day at 00:00 in the user's timezone
  const currentDayStart = dayjs().tz(iataTimeZone).startOf("day");
  const nextDayStart = currentDayStart.add(1, "day");

  // Query for food logs created today
  const foodLogsToday = await db.collection("FoodLog")
      .where("authId", "==", authId)
      .where("createdAt", ">=", Timestamp.fromDate(currentDayStart.toDate()))
      .where("createdAt", "<", Timestamp.fromDate(nextDayStart.toDate()))
      .get();

  // Initialize summary object
  const summary = {
    totalCalories: 0,
    totalCarbs: 0,
    totalProtein: 0,
    totalFat: 0,
    totalSugar: 0,
    totalSodium: 0,
    totalCholesterol: 0,
    totalFiber: 0,
  };

  // Calculate the summary values
  foodLogsToday.forEach((doc) => {
    const foodLog = doc.data();
    summary.totalCalories += foodLog.calories || 0;
    summary.totalCarbs += foodLog.carbs || 0;
    summary.totalProtein += foodLog.protein || 0;
    summary.totalFat += foodLog.fat || 0;
    summary.totalSugar += foodLog.sugar || 0;
    summary.totalSodium += foodLog.sodium || 0;
    summary.totalCholesterol += foodLog.cholesterol || 0;
    summary.totalFiber += foodLog.fiber || 0;
  });

  return summary;
});
