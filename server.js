const express = require("express");
const authRoutes = require("../Dietica-Mobile-App-Project_Backend-AI/functions/services/authServices"); 
const profile = require("../Dietica-Mobile-App-Project_Backend-AI/functions/services/profile"); 
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes); 
app.use('/profile', profile);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}.`);
});
