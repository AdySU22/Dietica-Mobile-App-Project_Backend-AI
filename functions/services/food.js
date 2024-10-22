const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../core/firestore");

exports.getAllFood = onCall(async (req) => {
  const {authId, page, limit} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (page === null || page === undefined || typeof page !== "number") {
    throw new HttpsError("invalid-argument", "page must not empty");
  }
  if (!limit || typeof limit !== "number") {
    throw new HttpsError("invalid-argument", "limit must not empty");
  }

  const foods = await db.collection("FoodLog")
      .where("authId", "==", authId)
      .orderBy("createdAt", "desc")
      .offset(page)
      .limit(limit)
      .get();

  return foods.docs.map((food) => ({
    id: food.id,
    ...food.data(),
  }));
});

exports.getFood = onCall(async (req) => {
  const {authId, foodId} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!foodId) {
    throw new HttpsError("invalid-argument", "foodId is required");
  }

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== authId) {
    throw new HttpsError("not-found", "Food not found");
  }

  return {
    id: foodDoc.id,
    ...foodDoc.data(),
  };
});

exports.createFood = onCall(async (req) => {
  const {authId, food} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!food) {
    throw new HttpsError("invalid-argument", "food is required");
  }

  const docRef = await db.collection("FoodLog").add({
    authId: authId,
    name: food.name,
    calories: food.calories,
    fat: food.fat,
    saturatedFat: food.saturatedFat,
    unsaturatedFat: food.unsaturatedFat,
    transFat: food.transFat,
    cholestrol: food.cholestrol,
    sodium: food.sodium,
    carbs: food.carbs,
    protein: food.protein,
    sugar: food.sugar,
    fiber: food.fiber,
    amount: food.amount,
    servingType: food.servingType,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {id: docRef.id};
});


exports.updateFood = onCall(async (req) => {
  const {authId, foodId, food} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!foodId) {
    throw new HttpsError("invalid-argument", "foodId is required");
  }
  if (!food) {
    throw new HttpsError("invalid-argument", "food is required");
  }

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== authId) {
    throw new HttpsError("not-found", "Food not found");
  }

  await foodDocRef.update({
    name: food.name,
    calories: food.calories,
    fat: food.fat,
    saturatedFat: food.saturatedFat,
    unsaturatedFat: food.unsaturatedFat,
    transFat: food.transFat,
    cholestrol: food.cholestrol,
    sodium: food.sodium,
    carbs: food.carbs,
    protein: food.protein,
    sugar: food.sugar,
    fiber: food.fiber,
    amount: food.amount,
    servingType: food.servingType,
    updatedAt: new Date(),
  });

  return {id: foodId};
});


exports.deleteFood = onCall(async (req) => {
  const {authId, foodId} = req.data;

  if (!authId) {
    throw new HttpsError("invalid-argument", "authId is required");
  }
  if (!foodId) {
    throw new HttpsError("invalid-argument", "foodId is required");
  }

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== authId) {
    throw new HttpsError("not-found", "Food not found");
  }

  await foodDocRef.delete();

  return `Deleted food ${foodId}`;
});
