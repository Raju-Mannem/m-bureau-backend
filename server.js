import express from "express";
import mongoose from "mongoose";
import user from "./model.js";
import middleware from "./middleware.js";
import jsonwebtoken from "jsonwebtoken";
import "dotenv/config";
import cors from "cors";
const app = express();
mongoose
  .connect(
    "mongodb+srv://rajumannem71:authtest@cluster0.1frqrgs.mongodb.net/mydatabase?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("db connection established");
  });

app.get("/", (req, res) => {
  res.send("server connected");
});
app.use(express.json());
app.use(cors({ origin: "*" }));
app.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmpassword } = req.body;
    let exist = await user.findOne({ email: email });
    if (exist) return res.status(400).send("user exist");
    if (password != confirmpassword) {
      return res.status(400).send("password and confirm password not matched");
    }
    let newUser = new user({
      username,
      email,
      password,
      confirmpassword,
    });
    await newUser.save();
    res.status(200).send("user registerd successfully");
  } catch (err) {
    console.log(err);
    return res.status(500).send("internall server error");
  }
});
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    let exist = await user.findOne({ email });
    if (!exist) return res.status(400).send("user not found");
    if (exist.password !== password) {
      return res.status(400).send("wrong password");
    }
    let payload = {
      user: {
        id: exist.id,
      },
    };
    jsonwebtoken.sign(
      payload,
      "jwtsecret",
      { expiresIn: 3600000 },
      (err, token) => {
        if (err) throw err;
        return res.json({ token });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(500).send("internall server error " + err);
  }
});
app.get("/myprofile", middleware, async (req, res) => {
  try {
    let exist = await user.findById(req.user.id);
    if (!exist) {
      return res.status(400).send("User not found");
    }
    res.json(exist);
  } catch (err) {
    console.log(err);
    return res.status(500).send("invalid token");
  }
});
app.listen(5000, () => {
  console.log("server is running on 5000");
});
