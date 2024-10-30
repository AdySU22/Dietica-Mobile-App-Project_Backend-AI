const {initializeApp, applicationDefault} = require("firebase-admin/app");

// Initialize the app only once
const app = initializeApp({
  credential: applicationDefault(),
  storageBucket: "gs://dietica-be3e3.appspot.com",
});

module.exports = app;
