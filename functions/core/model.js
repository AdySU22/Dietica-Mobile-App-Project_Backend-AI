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

const todoSchema = {
  "type": "object",
  "properties": {
    "food": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
        },
        "description": {
          "type": "string",
        },
      },
      "required": [
        "title",
        "description",
      ],
    },
    "exercise": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
        },
        "description": {
          "type": "string",
        },
      },
      "required": [
        "title",
        "description",
      ],
    },
    "water": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
        },
        "description": {
          "type": "string",
        },
      },
      "required": [
        "title",
        "description",
      ],
    },
  },
  "required": [
    "food",
    "exercise",
    "water",
  ],
};

exports.modelTodo = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
    You are a diet and exercise advisor.
    Only reply to diet and exercise topics.
    Provide steps to improve diet and suggest exercises.
  `,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: todoSchema,
  },
});
