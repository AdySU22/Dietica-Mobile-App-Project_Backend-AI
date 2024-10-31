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
    const waterLogSnapshot = await db.collection("WaterLogs")
        .where("authId", "==", authId)
        .get();

    if (waterLogSnapshot.empty) {
      const newDocRef = db.collection("WaterLogs").doc();

      await newDocRef.set({
        authId,
        amount,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      logger.info(`Water log created with ID: ${newDocRef.id}`);
      return {message: "Water log created successfully", id: newDocRef.id};
    } else {
      const existingDocRef = waterLogSnapshot.docs[0].ref;

      await existingDocRef.update({
        amount,
        updatedAt: Timestamp.now(),
      });

      logger.info(`Water log updated for authId: ${authId}`);
      return {message: "Water log updated successfully"};
    }
  } catch (error) {
    logger.error("Error creating or updating water log", error);
    throw new HttpsError("internal", "Error creating or updating water log");
  }
});

// Callable function to get water log data
exports.getWaterLog = onCall(async (req) => {
  const {authId} = req.data;

  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId");
  }

  logger.info(`Received request for water log data for authId: ${authId}`);

  try {
    const waterLogSnapshot = await db.collection("WaterLogs")
        .where("authId", "==", authId)
        .get();

    if (waterLogSnapshot.empty) {
      logger.info(`No water log data found for authId: ${authId}`);
      throw new HttpsError("not-found", "Water log data not found");
    }

    const waterLogData = waterLogSnapshot.docs[0].data();
    waterLogData.id = waterLogSnapshot.docs[0].id;
    logger.info(`Water log data retrieved successfully for authId: ${authId}`);
    return {
      message: "Water log data retrieved successfully", data: waterLogData,
    };
  } catch (error) {
    logger.error("Error retrieving water log data", error);
    throw new HttpsError("internal", "Error retrieving water log data");
  }
});
