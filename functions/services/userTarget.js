const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

// Callable function to set user target
exports.setUserTarget = onCall(async (req) => {
  const {authId, currentWeight, targetWeight, duration} = req.data;

  // Validate input data
  if (typeof authId !== "string" ||
    typeof currentWeight !== "number" ||
    typeof targetWeight !== "number" ||
    typeof duration !== "number") {
    logger.error("Invalid input data:", req.data);
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  logger.info("Received data to save/update user target:", req.data);

  try {
    // Check if a user target already exists
    const userTargetSnapshot = await db.collection("UserTargets")
        .where("authId", "==", authId)
        .get();

    // If no existing target, create a new one
    if (userTargetSnapshot.empty) {
      const newDocRef = db.collection("UserTargets").doc();
      await newDocRef.set({
        authId,
        weight: targetWeight,
        duration,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      logger.info(`User target created with ID: ${newDocRef.id}`);
      return {
        message: "User target created successfully",
        id: newDocRef.id,
      };
    } else {
      // Update existing target
      const existingDocRef = userTargetSnapshot.docs[0].ref;
      logger.info(`Updating target for authId: ${authId}`);

      await existingDocRef.update({
        weight: targetWeight,
        duration,
        updatedAt: Timestamp.now(),
      });

      logger.info(`User target updated for authId: ${authId}`);
      return {
        message: "User target updated successfully",
      };
    }
  } catch (error) {
    logger.error("Error creating or updating user target", error);
    throw new HttpsError("internal", "Error creating or updating user target");
  }
});

// Callable function to get user target
exports.getUserTarget = onCall(async (req) => {
  const {authId} = req.data;

  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId");
  }

  logger.info(`Received request for authId: ${authId}`);

  try {
    // Fetch user target data from Firestore
    const userTargetSnapshot = await db.collection("UserTargets")
        .where("authId", "==", authId)
        .get();

    // If no user target found, return a "not-found" error
    if (userTargetSnapshot.empty) {
      logger.info(`No user target found for authId: ${authId}`);
      throw new HttpsError("not-found", "User target not found");
    }

    // Get data from the document
    const userTargetData = userTargetSnapshot.docs[0].data();
    userTargetData.id = userTargetSnapshot.docs[0].id;

    logger.info(`User target retrieved successfully for authId: ${authId}`);
    return {
      message: "User target retrieved successfully",
      data: userTargetData,
    };
  } catch (error) {
    logger.error("Error retrieving user target", error);
    throw new HttpsError("internal", "Error retrieving user target");
  }
});
