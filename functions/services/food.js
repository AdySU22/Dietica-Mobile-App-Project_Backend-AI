const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../core/firestore");

exports.getAllFood = onCall(async (req) => {
  const {uid, page, limit} = req.data;

  const foods = await db.collection("FoodLog")
      .where("authId", "==", uid)
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
  const {uid, foodId} = req.data;

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== uid) {
    throw new HttpsError("not-found", "Food not found");
  }

  return {
    id: foodDoc.id,
    ...foodDoc.data(),
  };
});

exports.createFood = onCall(async (req) => {
  const {uid, food} = req.data;

  const docRef = await db.collection("FoodLog").add({
    authId: uid,
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
  const {uid, foodId, food} = req.data;

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== uid) {
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
  const {uid, foodId} = req.data;

  const foodDocRef = db.collection("FoodLog").doc(foodId);
  const foodDoc = await foodDocRef.get();

  if (!foodDoc.exists || foodDoc.data().authId !== uid) {
    throw new HttpsError("not-found", "Food not found");
  }

  await foodDocRef.delete();

  return `Deleted food ${foodId}`;
});
