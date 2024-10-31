const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

// Callable function to set user physical data
exports.setUserPhysical = onCall(async (req) => {
  const {
    authId,
    weight,
    height,
    gender,
    activityHours,
    softDrinkFastFood,
    medicine,
  } = req.data;

  // Validate input data types
  if (
    typeof authId !== "string" ||
    typeof weight !== "number" ||
    typeof height !== "number" ||
    typeof gender !== "string" ||
    typeof activityHours !== "number" ||
    typeof softDrinkFastFood !== "number" ||
    typeof medicine !== "string"
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    const userPhysicalSnapshot = await db.collection("UserPhysicals")
        .where("authId", "==", authId)
        .get();

    if (userPhysicalSnapshot.empty) {
      const newDocRef = db.collection("UserPhysicals").doc();

      await newDocRef.set({
        authId,
        weight,
        height,
        gender,
        activityHours,
        softDrinkFastFood,
        medicine,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      logger.info(`User physical data created with ID: ${newDocRef.id}`);
      return {
        message: "User physical data created successfully",
        id: newDocRef.id,
      };
    } else {
      const existingDocRef = userPhysicalSnapshot.docs[0].ref;

      await existingDocRef.update({
        weight,
        height,
        gender,
        activityHours,
        softDrinkFastFood,
        medicine,
        updatedAt: Timestamp.now(),
      });

      logger.info(`User physical data updated for authId: ${authId}`);
      return {message: "User physical data updated successfully"};
    }
  } catch (error) {
    logger.error("Error creating or updating user physical data", error);
    throw new HttpsError(
        "internal",
        "Error creating or updating user physical data",
    );
  }
});

// Callable function to get user physical data
exports.getUserPhysical = onCall(async (req) => {
  const {authId} = req.data;

  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId");
  }

  logger.info(`Received request for physical data for authId: ${authId}`);

  try {
    const userPhysicalSnapshot = await db.collection("UserPhysicals")
        .where("authId", "==", authId)
        .get();

    if (userPhysicalSnapshot.empty) {
      logger.info(`No physical data found for authId: ${authId}`);
      throw new HttpsError("not-found", "User physical data not found");
    }

    const userPhysicalData = userPhysicalSnapshot.docs[0].data();
    userPhysicalData.id = userPhysicalSnapshot.docs[0].id;
    logger.info(
        `User physical data retrieved successfully for authId: ${authId}`,
    );
    return {
      message: "User physical data retrieved successfully",
      data: userPhysicalData,
    };
  } catch (error) {
    logger.error("Error retrieving user physical data", error);
    throw new HttpsError("internal", "Error retrieving user physical data");
  }
});
