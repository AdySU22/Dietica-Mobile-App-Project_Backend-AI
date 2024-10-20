const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {homeFoodTodaySummary} = require("./services/home");
const {
  getAllFood,
  getFood,
  createFood,
  updateFood,
  deleteFood,
} = require("./services/food");
const {fatsecretSearch, fatsecretGet} = require("./services/fatsecret");
const {getChatbot, sendChatbot} = require("./services/chatbot");
const {generateTodo, getTodo} = require("./services/todo");
const {setUserTarget, getUserTarget} = require("./services/userTarget");


exports.helloWorld = onCall((request) => {
  logger.info("Hello logs!", {structuredData: true});
  return "Hello from Firebase!";
});

exports.homeFoodTodaySummary = homeFoodTodaySummary;

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

exports.setUserTarget = setUserTarget;
exports.getUserTarget = getUserTarget;
