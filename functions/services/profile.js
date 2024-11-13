const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");

// Get Profile function
exports.getProfile = onCall(async (req) => {
  const {authId} = req.data;

  // Validate authId
  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId format");
  }

  logger.info("Fetching user profile and physical data for authId:", authId);

  try {
    // Fetch user profile from Users collection
    const userProfileDoc = await db.collection("Users").doc(authId).get();
    if (!userProfileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const userProfile = userProfileDoc.data();

    // Fetch user physical data from UserPhysicals collection
    const userPhysicalSnapshot = await db.collection("UserPhysicals")
        .where("authId", "==", authId)
        .get();

    let userPhysicalData = null;
    if (!userPhysicalSnapshot.empty) {
      userPhysicalData = userPhysicalSnapshot.docs[0].data();
    } else {
      logger.info(`No physical data found for authId: ${authId}`);
    }

    const profile = {
      ...userProfile,
      ...(userPhysicalData ? {
        weight: userPhysicalData.weight,
        height: userPhysicalData.height,
        gender: userPhysicalData.gender,
        activityLevels: userPhysicalData.activityLevels,
        nickname: userPhysicalData.firstName||userProfile.nickname || null,
        birthday: userProfile.birthdate || null,
      } : {}),
    };

    logger.info(`User profile data retrieved for authId: ${authId}`);
    return {profile};
  } catch (error) {
    logger.error("Error fetching user profile and physical data", error);
    throw new HttpsError(
        "internal",
        `Failed to fetch user profile: ${error.message}`,
    );
  }
});


// Set Profile function
exports.setProfile = onCall(async (req) => {
  const {
    authId,
    firstName,
    birthdate,
    lastName,
    gender,
    height,
    weight,
  } = req.data;

  // Validate input data
  if (
    typeof authId !== "string" ||
    typeof firstName !== "string" ||
    typeof birthdate !== "string" ||
    typeof lastName !== "string" ||
    typeof gender !== "string" ||
    (height !== undefined && typeof height !== "number") ||
    (weight !== undefined && typeof weight !== "number")
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Convert birthdate to Date object
    const birthdateObj = new Date(birthdate);

    // Format birthdate as "01 Jan 1999"
    const formattedBirthdate = birthdateObj.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Convert formatted birthdate to Firestore Timestamp
    const birthdateTimestamp = Timestamp.fromDate(new Date(formattedBirthdate));

    // Update user profile in Firestore
    await db.collection("Users").doc(authId).set({
      firstName,
      birthdate: birthdateTimestamp,
      lastName,
      gender,
      height: height !== undefined ? height : null,
      weight: weight !== undefined ? weight : null,
    }, {merge: true});

    logger.info(`User profile updated successfully for authId: ${authId}`);
    return {message: "Profile updated successfully."};
  } catch (error) {
    logger.error("Error updating user profile", error);
    throw new HttpsError(
        "internal",
        `Failed to update user profile: ${error.message}`,
    );
  }
});
