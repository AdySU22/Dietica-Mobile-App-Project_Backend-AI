const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

// Callable function to set water log data
exports.setWaterLog = onCall(async (req) => {
  const {authId, amount} = req.data;

  // Validate input data types
  if (typeof authId !== "string" || typeof amount !== "number") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Create a new document with a unique ID in the WaterLogs collection
    const newDocRef = db.collection("WaterLogs").doc();

    await newDocRef.set({
      authId,
      amount,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info(`New water log created with ID: ${newDocRef.id}`);
    return {message: "Water log created successfully", id: newDocRef.id};
  } catch (error) {
    logger.error("Error creating new water log", error);
    throw new HttpsError("internal", "Error creating new water log");
  }
});
