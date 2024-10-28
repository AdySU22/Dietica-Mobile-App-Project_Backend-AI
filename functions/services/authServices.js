require('dotenv').config();
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { db } = require("../core/firestore");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // Use environment variable for host
  port: process.env.EMAIL_PORT, // Use environment variable for port
  secure: process.env.EMAIL_SECURE === 'true', // Use environment variable for secure
  auth: {
    user: process.env.EMAIL_USER, // Use environment variable for email
    pass: process.env.EMAIL_PASS, // Use environment variable for password
  },
});

// OTP expiration time set to 1 minute
const otpExpirationTime = 1 * 60 * 1000; // 1 minute

// Function to track OTP attempts
const MAX_OTP_ATTEMPTS = 4; // Maximum allowed attempts

async function trackOtpAttempts(email) {
  const attemptsDoc = await db.collection("OtpAttempts").doc(email).get();
  const currentTime = Date.now();

  if (attemptsDoc.exists) {
    const { attempts, lastAttemptTime } = attemptsDoc.data();

    // Reset attempts if the last attempt was more than 1 minute ago
    if (currentTime - lastAttemptTime > otpExpirationTime) {
      await db.collection("OtpAttempts").doc(email).set({ attempts: 1, lastAttemptTime: currentTime });
      return 1; // Reset attempts to 1
    }

    if (attempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "Maximum OTP attempts exceeded. Please request a new OTP.");
    }

    // Increment attempts
    await db.collection("OtpAttempts").doc(email).update({ attempts: attempts + 1 });
    return attempts + 1;
  } else {
    // First attempt
    await db.collection("OtpAttempts").doc(email).set({ attempts: 1, lastAttemptTime: currentTime });
    return 1; // First attempt
  }
}

// Signup function
exports.signup = onCall(async (req) => {
  const { email } = req.data;

  // Validate email format
  if (typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }

  // Generate OTP
  const otp = crypto.randomInt(1000, 9999).toString(); // Generate a 4-digit OTP
  const expiration = Date.now() + otpExpirationTime;

  // Store OTP and expiration in Firestore
  await db.collection("OtpCodes").doc(email).set({ otp, expiration });

  const mailOptions = {
    from: process.env.FUNCTIONS_EMAIL_USERNAME,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}. This code is valid for the next 1 minutes.`,
    html: `<strong>Your OTP code is: ${otp}</strong><br><p>This code is valid for the next 5 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent to email: ${email}`);
    return { message: "Signup initiated. Please check your email for the OTP." };
  } catch (error) {
    logger.error("Error sending OTP email", error);
    throw new HttpsError("internal", `Failed to send OTP email: ${error.message}`);
  }
});

exports.finalizeSignup = onCall(async (req) => {
  const { email, otp, password, firstName, lastName } = req.data;

  // Validate input data
  if (typeof email !== "string" || typeof otp !== "string" || typeof password !== "string" || 
      typeof firstName !== "string" || typeof lastName !== "string") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Track OTP attempts for this email
    await trackOtpAttempts(email);

    // Fetch stored OTP and expiration
    const otpDoc = await db.collection("OtpCodes").doc(email).get();
    if (!otpDoc.exists) {
      throw new HttpsError("not-found", "No OTP found for this email");
    }

    const { otp: storedOtp, expiration } = otpDoc.data();
    if (Date.now() > expiration) {
      throw new HttpsError("failed-precondition", "OTP has expired");
    }

    if (storedOtp !== otp) {
      throw new HttpsError("invalid-argument", "Invalid OTP");
    }

    // Proceed with creating user
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    // Store user details in Firestore
    await db.collection("Users").doc(userRecord.uid).set({
      firstName: firstName,
      lastName: lastName,
      email: email,
      createdAt: new Date()
    });

    // Cleanup OTP after successful signup
    await db.collection("OtpCodes").doc(email).delete();
    logger.info(`User signed up successfully for email: ${email}`);
    return { message: "Signup finalized successfully." };

  } catch (error) {
    logger.error("Error finalizing signup", error);
    throw new HttpsError(error.code || "internal", error.message || "Failed to finalize signup.");
  }
});

// Sign In function
exports.signin = onCall(async (req) => {
  const { email, password } = req.data;

  // Validate input data
  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  try {
    // Sign in the user with email and password
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // If the user exists, you can verify the password using the Firebase Admin SDK
    // However, the Admin SDK does not provide direct password verification
    // Here, we will simulate a sign-in response without password verification, which is usually done on the client side.

    // Respond with a success message
    return {
      message: "Sign in successful",
      uid: userRecord.uid,
      email: userRecord.email,
      // Optionally, you can return more user information if needed
    };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError("not-found", "User not found");
    } else if (error.code === 'auth/wrong-password') {
      throw new HttpsError("invalid-argument", "Invalid password");
    } else {
      logger.error("Error signing in", error);
      throw new HttpsError("internal", `Failed to sign in: ${error.message}`);
    }
  }
});

// Forgot Password function
exports.forgotPassword = onCall(async (req) => {
  const { email } = req.data;

  // Validate email format
  if (typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }

  // Generate OTP
  const otp = crypto.randomInt(1000, 9999).toString(); // Generate a 4-digit OTP
  const expiration = Date.now() + otpExpirationTime;

  // Store OTP and expiration in Firestore
  await db.collection("OtpCodes").doc(email).set({ otp, expiration });

  const mailOptions = {
    from: process.env.FUNCTIONS_EMAIL_USERNAME,
    to: email,
    subject: "Your OTP Code for Password Reset",
    text: `Your OTP code for password reset is: ${otp}. This code is valid for the next 1 minutes.`,
    html: `<strong>Your OTP code for password reset is: ${otp}</strong><br><p>This code is valid for the next 5 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent for password reset to email: ${email}`);
    return { message: "Password reset initiated. Please check your email for the OTP." };
  } catch (error) {
    logger.error("Error sending OTP email", error);
    throw new HttpsError("internal", `Failed to send OTP email: ${error.message}`);
  }
});

exports.resetPassword = onCall(async (req) => {
  const { email, otp, password, confirmPassword } = req.data;

  // Validate input data
  if (typeof email !== "string" || typeof otp !== "string" || typeof password !== "string" || typeof confirmPassword !== "string") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  if (password !== confirmPassword) {
    throw new HttpsError("failed-precondition", "Passwords do not match");
  }

  try {
    // Track OTP attempts
    await trackOtpAttempts(email);

    // Retrieve OTP from Firestore
    const otpDoc = await db.collection("OtpCodes").doc(email).get();
    if (!otpDoc.exists) {
      throw new HttpsError("not-found", "No OTP found for this email");
    }

    const { otp: storedOtp, expiration } = otpDoc.data();
    if (Date.now() > expiration) {
      throw new HttpsError("failed-precondition", "OTP has expired");
    }

    if (storedOtp !== otp) {
      throw new HttpsError("invalid-argument", "Invalid OTP");
    }

    // Reset password
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password });

    // Delete OTP after successful reset
    await db.collection("OtpCodes").doc(email).delete();
    logger.info(`Password reset successfully for email: ${email}`);
    return { message: "Password reset successfully." };

  } catch (error) {
    logger.error("Error resetting password", error);
    throw new HttpsError(error.code || "internal", error.message || "Failed to reset password.");
  }
});

// Google Signin function (optional, implement as needed)
exports.googleSignin = onCall(async (req) => {
  // Logic for Google Signin
});