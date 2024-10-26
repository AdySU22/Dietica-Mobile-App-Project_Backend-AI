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

// OTP expiration time
const otpExpirationTime = 5 * 60 * 1000; // 5 minutes

// Send OTP function
exports.sendOtp = onCall(async (req) => {
  const { email } = req.data;

  // Validate email format
  if (typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }

  const otp = crypto.randomInt(1000, 9999).toString(); // Generate a 4-digit OTP
  const expiration = Date.now() + otpExpirationTime;

  // Store OTP and expiration in Firestore
  await db.collection("OtpCodes").doc(email).set({ otp, expiration });

  const mailOptions = {
    from: process.env.FUNCTIONS_EMAIL_USERNAME, // Use environment variable for email
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}. This code is valid for the next 5 minutes.`,
    html: `<strong>Your OTP code is: ${otp}</strong><br><p>This code is valid for the next 5 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent to email: ${email}`);
    return { message: "OTP sent successfully" };
  } catch (error) {
    logger.error("Error sending OTP email", error);
    throw new HttpsError("internal", `Failed to send OTP email: ${error.message}`);
  }
});

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
    text: `Your OTP code is: ${otp}. This code is valid for the next 5 minutes.`,
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

// Finalize Signup function (combined with OTP verification)
exports.finalizeSignup = onCall(async (req) => {
  const { email, otp, password, firstName, lastName } = req.data; // Collect necessary data

  // Validate input data
  if (typeof email !== "string" || typeof otp !== "string" || typeof password !== "string" || 
      typeof firstName !== "string" || typeof lastName !== "string") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

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

  try {
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    // Store additional user information in Firestore
    await db.collection("Users").doc(userRecord.uid).set({
      firstName: firstName,
      lastName: lastName,
      email: email,
      // createdAt: admin.firestore.FieldValue.serverTimestamp() (comment ga tau kenapa error tp user register success)
      createdAt: new Date()
    });

    await db.collection("OtpCodes").doc(email).delete(); // Delete OTP after successful signup

    logger.info(`User signed up successfully for email: ${email}`);
    return { message: "Signup finalized successfully." };
  } catch (error) {
    logger.error("Error creating user", error);
    throw new HttpsError("internal", `Failed to create user: ${error.message}`);
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
    text: `Your OTP code for password reset is: ${otp}. This code is valid for the next 5 minutes.`,
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

// Reset Password function
exports.resetPassword = onCall(async (req) => {
  const { email, otp, password, confirmPassword } = req.data;

  // Validate input data
  if (typeof email !== "string" || typeof otp !== "string" || typeof password !== "string" || typeof confirmPassword !== "string") {
    throw new HttpsError("invalid-argument", "Invalid input data");
  }

  // Check if the new password and confirm password match
  if (password !== confirmPassword) {
    throw new HttpsError("failed-precondition", "Passwords do not match");
  }

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
  try {
    // Update user password in Firebase Authentication
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password });

    await db.collection("OtpCodes").doc(email).delete(); // Delete OTP after successful password reset

    logger.info(`Password reset successfully for email: ${email}`);
    return { message: "Password reset successfully." };
  } catch (error) {
    logger.error("Error resetting password", error);
    throw new HttpsError("internal", `Failed to reset password: ${error.message}`);
  }
});

// Google Signin function (optional, implement as needed)
exports.googleSignin = onCall(async (req) => {
  // Logic for Google Signin
});
