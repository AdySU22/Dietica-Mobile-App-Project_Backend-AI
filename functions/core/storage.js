const {getStorage} = require("firebase-admin/storage");
require("./firebase");

const bucket = getStorage().bucket();
exports.bucket = bucket;
