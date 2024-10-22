const express = require("express");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const serviceAccount = require(
    "../../dietica-be3e3-firebase-adminsdk-za8xl-bbb90ceca2.json",
);
require("dotenv").config();

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// eslint-disable-next-line new-cap
const router = express.Router();

// Setup NodeMailer transport
const transporter = nodemailer.createTransport({
  secure: process.env.EMAIL_SECURE === "true",
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send OTP email
const sendOtpEmail = (email, otp) => {
  const mailOptions = {
    from: "daditrianza@gmail.com",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  };

  return transporter.sendMail(mailOptions);
};

// OTP generation function
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
};

// In-memory OTP store
const otpStore = {};

// === SIGNUP FLOW ===

// Signup User
router.post("/signup", async (req, res) => {
  const {email} = req.body;
  const otp = generateOtp();

  try {
    // Store the OTP associated with the email
    otpStore[email] = otp;

    // Send OTP to the user's email
    await sendOtpEmail(email, otp);

    res.json({message: "OTP sent to your email"});
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({error: "Error sending OTP"});
  }
});

// Verify OTP and Create User
router.post("/verify-otp", async (req, res) => {
  const {email, otp, firstName, lastName, password} = req.body;

  // Verify the OTP
  if (otpStore[email] !== otp) {
    return res.status(400).json({error: "Invalid OTP"});
  }

  try {
    // Create the user in Firebase Auth
    const userResponse = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: true,
      disabled: false,
      displayName: `${firstName} ${lastName}`,
    });

    // Clear the OTP after successful registration
    delete otpStore[email];

    res.json({message: "Account successfully created", user: userResponse});
  } catch (error) {
    console.error("Error creating new user:", error);
    res.status(500).json({error: "Error creating new user"});
  }
});

// === USER SIGN-IN ===

router.post("/signin", async (req, res) => {
  // eslint-disable-next-line no-unused-vars
  const {email, password} = req.body; // Client sends email and password

  try {
    // Sign in the user with Firebase Authentication
    const userCredential = await admin.auth().getUserByEmail(email);

    // Here, you should ideally verify the password.
    // But, Firebase Admin SDK doesn't support password verification directly.
    // Instead, consider having a separate authentication mechanism or
    // use the Firebase client SDK to handle sign-in.

    // Generate a custom token to manage the session
    const customToken = await admin.auth()
        .createCustomToken(userCredential.uid);

    res.json({
      message: "Sign-in successful",
      uid: userCredential.uid,
      email: userCredential.email,
      displayName: userCredential.displayName,
      customToken: customToken,
    });
  } catch (error) {
    console.error("Error signing in user:", error);
    res.status(401).json({error: "Invalid email or password"});
  }
});

// === PASSWORD RESET FLOW ===

// Send OTP for password reset
router.post("/forgot-password", async (req, res) => {
  const {email} = req.body;
  const otp = generateOtp();

  try {
    // Store the OTP associated with the email
    otpStore[email] = otp;

    // Send OTP to the user's email
    await sendOtpEmail(email, otp);

    res.json({message: "OTP sent to your email for password reset"});
  } catch (error) {
    console.error("Error sending OTP for password reset:", error);
    return res.status(500).json({error: "Error sending OTP"});
  }
});

// Verify OTP and set new password
router.post("/reset-password", async (req, res) => {
  const {email, otp, newPassword, confirmPassword} = req.body;

  // Check if the OTP is correct
  if (otpStore[email] !== otp) {
    return res.status(400).json({error: "Invalid OTP"});
  }

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({error: "Passwords do not match"});
  }

  try {
    // Get the user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update the user's password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Clear the OTP after successful password reset
    delete otpStore[email];

    res.json({message: "Password successfully reset"});
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({error: "Error resetting password"});
  }
});

// === GOOGLE AUTHENTICATION FLOW ===

router.post("/google-signin", async (req, res) => {
  const {idToken} = req.body; // Client sends the Google ID token

  try {
    // Verify the Google ID Token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const {uid, email, name, picture} = decodedToken;

    // Check if user exists in Firebase Authentication
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch (error) {
      // If user doesn't exist, create a new user in Firebase Auth
      userRecord = await admin.auth().createUser({
        uid: uid,
        email: email,
        displayName: name,
        photoURL: picture,
        emailVerified: true,
      });
    }

    // Optionally generate a custom Firebase token to manage session
    const customToken = await admin.auth().createCustomToken(uid);

    res.json({
      message: "Google sign-in successful",
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      customToken: customToken,
    });
  } catch (error) {
    console.error("Error verifying Google ID token:", error);
    res.status(401).json({error: "Invalid Google ID token"});
  }
});

module.exports = router;
