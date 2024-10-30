const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const {homeFoodTodaySummary} = require("./services/home");
const {getReport} = require("./services/report");
const {
  getAllFood,
  getFood,
  createFood,
  updateFood,
  deleteFood,
} = require("./services/food");
const {fatsecretSearch, fatsecretGet} = require("./services/fatsecret");
const {getChatbot, sendChatbot} = require("./services/chatbot");
const {generateTodo, getTodo, generateTodoAlt} = require("./services/todo");
const {setUserTarget, getUserTarget} = require("./services/userTarget");
const {setUserPhysical, getUserPhysical} = require("./services/userPhysical");
const {
  signin,
  signup,
  finalizeSignup,
  forgotPassword,
  resetPassword,
  googleSignin,
} = require("./services/authServices");
const {getProfile, setProfile} = require("./services/profile");
const {getWaterLog, setWaterLog} = require("./services/WaterLog");

exports.helloWorld = onCall((request) => {
  logger.info("Hello logs!", {structuredData: true});
  return "Hello from Firebase!";
});

// This cron schedule runs the function every day at midnight.
exports.helloScheduler = onSchedule("0 0 * * *", () => {
  logger.info("Hello scheduler!", {structuredData: true});
  return "Returned from hello scheduler!";
});

exports.homeFoodTodaySummary = homeFoodTodaySummary;

exports.getReport = getReport;

exports.getAllFood = getAllFood;
exports.getFood = getFood;
exports.createFood = createFood;
exports.updateFood = updateFood;
exports.deleteFood = deleteFood;

exports.fatsecretSearch = fatsecretSearch;
exports.fatsecretGet = fatsecretGet;

exports.getChatbot = getChatbot;
exports.sendChatbot = sendChatbot;

exports.getTodo = getTodo;
exports.generateTodo = generateTodo;
exports.generateTodoAlt = generateTodoAlt;

exports.setUserTarget = setUserTarget;
exports.getUserTarget = getUserTarget;

exports.setUserPhysical = setUserPhysical;
exports.getUserPhysical = getUserPhysical;

exports.signin = signin;
exports.signup = signup;
exports.finalizeSignup = finalizeSignup;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.googleSignin = googleSignin;

exports.setProfile = setProfile;
exports.getProfile = getProfile;

exports.getWaterLog = getWaterLog;
exports.setWaterLog = setWaterLog;

