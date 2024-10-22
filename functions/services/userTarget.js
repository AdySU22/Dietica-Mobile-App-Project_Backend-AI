const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

// Callable function to set user target
exports.setUserTarget = onCall(async (req) => {
  const {authId, weight, duration} = req.data;

  if (typeof authId !== "string" ||
    typeof weight !== "number" ||
    typeof duration !== "number") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    const userTargetSnapshot = await db.collection("UserTargets")
        .where("authId", "==", authId)
        .get();

    if (userTargetSnapshot.empty) {
      const newDocRef = db.collection("UserTargets").doc();

      await newDocRef.set({
        authId,
        weight,
        duration,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      logger.info(`User target created with ID: ${newDocRef.id}`);
      return {message: "User target created successfully", id: newDocRef.id};
    } else {
      const existingDocRef = userTargetSnapshot.docs[0].ref;

      await existingDocRef.update({
        weight,
        duration,
        updatedAt: Timestamp.now(),
      });

      logger.info(`User target updated for authId: ${authId}`);
      return {message: "User target updated successfully"};
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
    const userTargetSnapshot = await db.collection("UserTargets")
        .where("authId", "==", authId)
        .get();

    if (userTargetSnapshot.empty) {
      logger.info(`No user target found for authId: ${authId}`);
      throw new HttpsError("not-found", "User target not found");
    }

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
