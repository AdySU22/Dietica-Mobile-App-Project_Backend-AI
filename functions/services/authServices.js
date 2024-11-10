/* eslint-disable require-jsdoc */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const validator = require("validator");
const functions = require("firebase-functions");
const axios = require("axios");

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const otpExpirationTime = 1 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 4;

async function trackOtpAttempts(email) {
  const attemptsDoc = await db.collection("OtpAttempts").doc(email).get();
  const currentTime = Date.now();

  if (attemptsDoc.exists) {
    const {attempts, lastAttemptTime} = attemptsDoc.data();
    if (currentTime - lastAttemptTime > otpExpirationTime) {
      await db.collection("OtpAttempts").doc(email).set({
        attempts: 1,
        lastAttemptTime: currentTime,
      });
      return 1;
    }

    if (attempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpsError(
          "resource-exhausted",
          "Maximum OTP attempts exceeded. Please request a new OTP.",
      );
    }

    await db.collection("OtpAttempts").doc(email).update({
      attempts: attempts + 1,
    });
    return attempts + 1;
  } else {
    await db.collection("OtpAttempts").doc(email).set({
      attempts: 1,
      lastAttemptTime: currentTime,
    });
    return 1;
  }
}

async function validateOtp(email, otp) {
  await trackOtpAttempts(email);

  const otpDoc = await db.collection("OtpCodes").doc(email).get();
  logger.info(`Validating OTP for email: ${email}`,
      {otpDocExists: otpDoc.exists});

  if (!otpDoc.exists) {
    logger.warn(`No OTP found for email: ${email}`);
    throw new HttpsError("not-found", "No OTP found for this email");
  }

  const {otp: storedOtp, expiration, isVerified} = otpDoc.data();
  logger.info(`Stored OTP: ${storedOtp}, Incoming OTP: ${otp}`);

  if (isVerified == true) {
    throw new HttpsError("failed-precondition",
        "Error: Try to re-register your account.");
  }

  if (Date.now() > expiration) {
    logger.warn(`OTP has expired for email: ${email}`);
    throw new HttpsError("failed-precondition", "OTP has expired");
  }

  if (storedOtp.trim() !== otp.trim()) {
    logger.warn(`Invalid OTP for email: ${email}`);
    throw new HttpsError("failed-precondition", "Invalid OTP");
  }

  await db.collection("OtpCodes").doc(email).update({
    isVerified: true,
  });

  // await db.collection("OtpCodes").doc(email).delete();
  return true;
}

// Signup Function
exports.signup = onCall(async (req) => {
  const {email} = req.data;

  if (!validator.isEmail(email)) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid email format",
    );
  }

  const otp = crypto.randomInt(1000, 9999).toString();
  const expiration = Date.now() + otpExpirationTime;
  const isVerified = false;

  await db.collection("OtpCodes").doc(email).set({otp, expiration, isVerified});

  // Logging the OTP and expiration time
  logger.info(`Stored OTP for email: ${email}`, {otp, expiration});

  const mailOptions = {
    from: process.env.FUNCTIONS_EMAIL_USERNAME,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}. This code is valid for the next 1 minute.`,
    html: `<strong>Your OTP code is: ${otp}</strong><br>
           <p>This code is valid for the next 1 minute.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent to email: ${email}`);
    return {
      message: "Signup initiated. Please check your email for the OTP.",
    };
  } catch (error) {
    logger.error("Error sending OTP email", error);
    throw new HttpsError(
        "internal",
        `Failed to send OTP email: ${error.message}`,
    );
  }
});

// Verify OTP Function
exports.verifyOtp = onCall(async (req) => {
  const {email, otp} = req.data;

  // Validate email and OTP format
  if (!validator.isEmail(email) || typeof otp !== "string") {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid OTP",
    );
  }

  try {
    await validateOtp(email, otp);
    return {valid: true};
  } catch (error) {
    logger.error("Error verifying OTP", error);
    return {valid: false}; // On any error, return false
  }
});

// Finalize Signup Function (General Information)
exports.finalizeSignup = onCall(async (req) => {
  const {email, password, confirmPassword, firstName, lastName} = req.data;

  // Check input types
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    typeof firstName !== "string" ||
    typeof lastName !== "string"
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  // Password match check
  if (password !== confirmPassword) {
    throw new HttpsError("failed-precondition", "Passwords do not match");
  }

  try {
    // await validateOtp(email, otp); // Pass the OTP to validate
    const doc = await db.collection("OtpCodes").doc(email).get();

    if (doc.data().isVerified === false) {
      throw new HttpsError(
          "permission-denied",
          "Your request is unauthorized.");
    }

    const existingUser = await admin.auth().getUserByEmail(email).catch((
    ) => null);
    if (existingUser) {
      throw new HttpsError("already-exists", "User already exists");
    }

    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    await db.collection("Users").doc(userRecord.uid).set({
      firstName: firstName,
      lastName: lastName,
      email: email,
      createdAt: new Date(),
    });

    logger.info(`User signed up successfully for email: ${email}`);
    return {message: "Signup finalized successfully."};
  } catch (error) {
    logger.error("Error finalizing signup", error);
    throw new HttpsError(
        error.code || "internal",
        error.message || "Failed to finalize signup.",
    );
  }
});

// Signin Function
exports.signin = onCall(async (req) => {
  const {email, password} = req.data;

  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpsError("invalid-argument", "Email or password invalid");
  }

  try {
    const apiKey = process.env.API_KEY;
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await axios.post(authUrl, {
      email,
      password,
      returnSecureToken: true,
    });

    // Generate a new custom token after login to ensure token validity
    const idToken = await admin.auth().createCustomToken(response.data.localId);

    return {
      message: "Sign in successful",
      uid: response.data.localId,
      email: email,
      idToken: idToken,
    };
  } catch (error) {
    if (error.response && error.response.data.error.code === 400) {
      throw new HttpsError("unauthenticated", "Wrong email or password");
    } else {
      console.error("Error signing in", error);
      throw new HttpsError("internal", `Failed to sign in: ${error.message}`);
    }
  }
});


// Forgot Password Function - Request OTP
exports.forgotPassword = onCall(async (req) => {
  const {email} = req.data;

  if (typeof email !== "string" || !validator.isEmail(email)) {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }

  const otp = crypto.randomInt(1000, 9999).toString();
  const expiration = Date.now() + otpExpirationTime;

  await db.collection("OtpCodes").doc(email).set({
    otp,
    expiration,
    isVerified: false,
  });

  const mailOptions = {
    from: process.env.FUNCTIONS_EMAIL_USERNAME,
    to: email,
    subject: "Your OTP Code for Password Reset",
    text: `Your OTP code for password reset is: ${otp}. 
    This code is valid for the next 1 minute.`,
    html: `<strong>Your OTP code for password reset is: ${otp}</strong><br>
           <p>This code is valid for the next 1 minute.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent for password reset to email: ${email}`);
    return {
      message: "Password reset initiated. Please check your email for the OTP.",
    };
  } catch (error) {
    logger.error("Error sending OTP email", error);
    throw new HttpsError(
        "internal",
        `Failed to send OTP email: ${error.message}`,
    );
  }
});

// Reset Password Function - Verify OTP and Update Password
exports.resetPassword = onCall(async (req) => {
  const {email, password, confirmPassword} = req.data;

  // Check input types
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  // Password match check
  if (password !== confirmPassword) {
    throw new HttpsError("failed-precondition", "Passwords do not match");
  }

  try {
    const otpDoc = await db.collection("OtpCodes").doc(email).get();
    if (otpDoc.data().isVerified === false) {
      throw new HttpsError(
          "permission-denied",
          "OTP is not verified.",
      );
    }

    if (!otpDoc.exists) {
      throw new HttpsError(
          "not-found",
          "No OTP verification found for this email.",
      );
    }

    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password
    await admin.auth().updateUser(userRecord.uid, {password: password});

    // Log the password update
    logger.info(`Password updated for user: ${userRecord.uid}`);

    // Revoke any existing refresh tokens
    await admin.auth().revokeRefreshTokens(userRecord.uid);

    // Wait for Firebase to fully process the token revocation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return {message: "Password reset successfully."};
  } catch (error) {
    logger.error(
        "Error resetting password",
        {
          email: email,
          error: error.message,
        },
    );
    throw new HttpsError(
        error.code || "internal",
        error.message || "Failed to reset password due to an internal error.",
    );
  }
});

