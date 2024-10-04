const {GoogleGenerativeAI} = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

exports.model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
    You are a diet and exercise advisor.
    Only reply to diet and exercise topics.
    Provide steps to improve diet and suggest exercises.
  `,
});
