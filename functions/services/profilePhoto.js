const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {bucket} = require("../core/storage");

exports.uploadProfilePhoto = onCall(async (request) => {
  const {authId, base64Image} = request.data;

  // Ensure the user is authenticated
  if (!authId) {
    throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to upload an image.",
    );
  }

  // Extract base64-encoded image string
  if (!base64Image) {
    throw new HttpsError(
        "invalid-argument",
        "The function must be called with 'base64Image'",
    );
  }

  try {
    const file = bucket.file(`profile/${authId}`);

    // Create a buffer from the base64-encoded string
    const buffer = Buffer.from(base64Image, "base64");

    // Upload the file to Cloud Storage
    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg", // or "image/png" based on the image format
      },
    });

    // Get the public URL for the uploaded file
    const fileUrl = file.publicUrl();

    const user = await admin.auth().getUser(authId);
    const updatedClaims = {
      ...user.customClaims, // Preserve existing custom claims
      profilePhotoUrl: fileUrl, // Update or add the profilePhotoUrl field
    };
    await admin.auth().setCustomUserClaims(authId, updatedClaims);

    return {
      message: "Image uploaded successfully",
      fileUrl,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new HttpsError("internal", "Failed to upload image");
  }
});

exports.deleteProfilePhoto = onCall(async (request) => {
  const {authId} = request.data;
  // Ensure the user is authenticated
  if (!authId) {
    throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to upload an image.",
    );
  }

  try {
    const file = bucket.file(`profile/${authId}`);
    await file.delete();

    const user = await admin.auth().getUser(authId);
    const updatedClaims = {
      ...user.customClaims,
      profilePhotoUrl: undefined,
    };
    await admin.auth().setCustomUserClaims(authId, updatedClaims);

    return {
      message: "Profile photo deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting profile photo:", error);
    throw new HttpsError("internal", "Failed to delete profile photo");
  }
});
