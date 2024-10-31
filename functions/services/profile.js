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

  logger.info("Fetching user profile for authId:", authId); // Log authId

  try {
    const userProfileDoc = await db.collection("Users").doc(authId).get();
    if (!userProfileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }

    const userProfile = userProfileDoc.data();
    return {profile: userProfile};
  } catch (error) {
    logger.error("Error fetching user profile", error);
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
    email,
    birthdate,
    profilePhotoUrl,
    lastName,
    gender,
    height,
    weight,
  } = req.data;

  // Validate input data
  if (
    typeof authId !== "string" ||
    typeof firstName !== "string" ||
    typeof email !== "string" ||
    typeof birthdate !== "string" ||
    (profilePhotoUrl && typeof profilePhotoUrl !== "string") ||
      typeof lastName !== "string" || typeof gender !== "string" ||
      (height !== undefined && typeof height !== "number") ||
      (weight !== undefined && typeof weight !== "number")) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Convert birthdate to Firestore Timestamp
    const birthdateTimestamp = Timestamp.fromDate(new Date(birthdate));

    // Update user profile in Firestore
    await db.collection("Users").doc(authId).set({
      firstName,
      email,
      birthdate: birthdateTimestamp, // Store as Timestamp
      profilePhotoUrl,
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
