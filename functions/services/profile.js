const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// === GET PROFILE ===
router.get('/getProfile', async (req, res) => {
    const { uid } = req.query; // Use req.query to get uid from query parameters

    if (!uid) {
        return res.status(400).json({ error: 'User ID (uid) is required' });
    }

    try {
        const userRecord = await admin.auth().getUser(uid);
        res.json({
            name: userRecord.displayName,
            email: userRecord.email,
            dateOfBirth: userRecord.customClaims?.dateOfBirth || 'Not set',
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: 'Error fetching user profile' });
    }
});

// === UPDATE PROFILE ===
router.put('/updateProfile', async (req, res) => {
    const { uid, newName, dateOfBirth } = req.body;

    if (!uid || !newName) {
        return res.status(400).json({ error: 'User ID (uid) and new name are required' });
    }

    try {
        // Update the user's display name in Firebase Auth
        await admin.auth().updateUser(uid, {
            displayName: newName,
        });

        // Optionally set custom claims to store non-auth related data (like date of birth)
        if (dateOfBirth) {
            await admin.auth().setCustomUserClaims(uid, { dateOfBirth });
        }

        res.json({ message: 'Profile successfully updated' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: 'Error updating user profile' });
    }
});

module.exports = router;
