const {getFirestore} = require("firebase-admin/firestore");
require("./firebase");

const db = getFirestore();
db.settings({ignoreUndefinedProperties: true});

exports.db = db;
