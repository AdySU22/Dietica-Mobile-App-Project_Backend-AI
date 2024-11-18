const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

// Callable function to set exercise log data
exports.setExerciseLog = onCall(async (req) => {
  const {authId, name, duration} = req.data;

  // Validate input data types
  if (typeof authId !== "string" || typeof name !== "string" || typeof duration !== "number") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  if (duration <= 0) {
    throw new HttpsError("invalid-argument", "Duration must be a positive number");
  }

  try {
    // Create a new document with a unique ID in the ExerciseLogs collection
    const newDocRef = db.collection("ExerciseLogs").doc();

    await newDocRef.set({
      authId,
      name,
      duration,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info(`New exercise log created with ID: ${newDocRef.id}`);
    return {message: "Exercise log created successfully", id: newDocRef.id};
  } catch (error) {
    logger.error("Error creating new exercise log", error);
    throw new HttpsError("internal", "Error creating new exercise log");
  }
});

// Callable function to get exercise log data by authId
exports.getExerciseLog = onCall(async (req) => {
  const {authId} = req.data;

  // Validate input data types
  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId");
  }

  try {
    // Query the ExerciseLogs collection for documents matching the authId
    const snapshot = await db.collection("ExerciseLogs")
      .where("authId", "==", authId)
      .orderBy("createdAt", "desc")  // Optionally order by createdAt
      .get();

    if (snapshot.empty) {
      return {message: "No exercise logs found for this user"};
    }

    // Map snapshot data into an array of exercise logs
    const exerciseLogs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info(`Retrieved ${exerciseLogs.length} exercise logs for authId: ${authId}`);
    return {exerciseLogs};
  } catch (error) {
    logger.error("Error retrieving exercise logs", error);
    throw new HttpsError("internal", "Error retrieving exercise logs");
  }
});
