const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../core/firestore");

exports.setUserToken = onCall(async (req) => {
  const {authId, token} = req.data;

  if (typeof authId !== "string") {
    throw new HttpsError("invalid-argument", "Invalid authId format");
  }

  if (typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Invalid token format");
  }

  const userTokens = await db.collection("UserToken")
      .where("authId", "==", authId)
      .limit(1)
      .get();
  if (userTokens.empty) {
    await db.collection("UserToken").add({
      authId: authId,
      token: token,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    const ref = userTokens.docs[0].ref;
    await ref.update({
      token: token,
      updatedAt: new Date(),
    });
  }

  return {
    message: "User token updated successfully",
  };
});
