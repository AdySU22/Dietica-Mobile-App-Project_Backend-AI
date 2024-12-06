const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {Timestamp} = require("firebase-admin/firestore");
const {db} = require("../core/firestore");

// Get Profile function
exports.getProfileV2 = onCall(async (req) => {
  const {authId} = req.data;

  // Validate authId
  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId format");
  }

  logger.info("Fetching user profile and physical data for authId:", authId);

  try {
    // Fetch user profile from Users collection
    const doc = await db.collection("UserV2").doc(authId).get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "User profile not found");
    }
    const userProfile = doc.data();

    logger.info(`User profile data retrieved for authId: ${authId}`);
    return {
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email,
      birthdate: userProfile.birthdate,
      weight: userProfile.weight,
      height: userProfile.height,
      gender: userProfile.gender,
      activityLevels: userProfile.activityLevels,
      softDrinkFastFood: userProfile.softDrinkFastFood,
      illnesses: userProfile.illnesses,
    };
  } catch (error) {
    logger.error("Error fetching user profile", error);
    throw new HttpsError(
        "internal",
        `Failed to fetch user profile: ${error.message}`,
    );
  }
});


// Set Profile function
exports.setProfileV2 = onCall(async (req) => {
  const {
    authId,
    firstName,
    lastName,
    birthdate,
    weight,
    height,
    gender,
    activityLevels,
    softDrinkFastFood,
    illnesses,
  } = req.data;

  // Validate input data
  if (
    typeof authId !== "string" ||
    (firstName != null && typeof firstName !== "string") ||
    (lastName != null && typeof lastName !== "string") ||
    (birthdate != null && typeof birthdate !== "string") ||
    (weight != null && typeof weight !== "number") ||
    (height != null && typeof height !== "number") ||
    (gender != null && typeof gender !== "string") ||
    (activityLevels != null && typeof activityLevels !== "string") ||
    (softDrinkFastFood != null && typeof softDrinkFastFood !== "number") ||
    (illnesses != null && typeof illnesses !== "string")
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    logger.info(`Updating profile for authId: ${authId}`);

    // Update user profile in Firestore
    const updates = {updatedAt: new Date()};
    if (firstName != null) updates.firstName = firstName;
    if (lastName != null) updates.lastName = lastName;
    if (birthdate != null) {
      // Convert birthdate to Firestore Timestamp
      const birthdateTimestamp = Timestamp.fromDate(new Date(birthdate));
      updates.birthdate = birthdateTimestamp;
    }
    if (weight != null) updates.weight = weight;
    if (height != null) updates.height = height;
    if (gender != null) updates.gender = gender;
    if (activityLevels != null) updates.activityLevels = activityLevels;
    if (softDrinkFastFood != null) {
      updates.softDrinkFastFood = softDrinkFastFood;
    }
    if (illnesses !== null) updates.illnesses = illnesses;
    await db.collection("UserV2").doc(authId).set(updates, {merge: true});

    return {message: "Profile updated successfully."};
  } catch (error) {
    logger.error("Error updating user profile", error);
    throw new HttpsError(
        "internal",
        `Failed to update user profile: ${error.message}`,
    );
  }
});
