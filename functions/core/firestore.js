const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
db.settings({ignoreUndefinedProperties: true});

exports.db = db;
