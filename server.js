const express = require("express");
const authRoutes = require("../Dietica-Mobile-App-Project_Backend-AI/functions/services/authServices"); 
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use the auth routes
app.use('/auth', authRoutes); 

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}.`);
});
