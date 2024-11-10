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
    activityLevels,
    illnesses,
  } = req.data;

  // Validate input data types
  if (
    typeof authId !== "string" ||
    typeof weight !== "number" ||
    typeof height !== "number" ||
    typeof gender !== "string" ||
    typeof activityLevels !== "string" ||
    (illnesses !== undefined && typeof illnesses !== "string") // Optional field
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Always create a new document instead of checking for an existing one
    const newDocRef = db.collection("UserPhysicals").doc();

    await newDocRef.set({
      authId,
      weight,
      height,
      gender,
      activityLevels,
      illnesses: illnesses || null, // Set to null if undefined
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info(`User physical data created with ID: ${newDocRef.id}`);
    return {
      message: "User physical data created successfully",
      id: newDocRef.id,
    };
  } catch (error) {
    logger.error("Error creating user physical data", error);
    throw new HttpsError(
        "internal",
        "Error creating user physical data",
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
