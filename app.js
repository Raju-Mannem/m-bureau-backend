import express from "express";
import mongoose from "mongoose";
import {Admin, User, Profiles} from "./model.js";
import { auth } from './middleware.js';
import 'dotenv/config'
import cors from "cors";
import Serverless from "serverless-http";
import bodyParser from "body-parser";

const app = express();
app.use(cors({ origin: "*"}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.get("/", (req, res) => {
  res.send("server connected");
});

app.post('/api/users', auth, async (req, res) => {
  const { email, id: googleId } = req.user;
  try {
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await new User({ email, googleId }).save();
    }
    res.json({ user });
  } catch (error) {
    res.status(400).send({ error: error.message || "An error occurred" });
  }
});

app.post('/api/adminlogin', async (req, res) => {
  try {
    const { adminName, adminPassword } = req.body;
    const adminExists = await Admin.findOne({ adminName: adminName });
    if (!adminExists) {
      res.status(401).send({ error: "Invalid Credentials" });
      return;
    }
    if (adminExists.password !== adminPassword) {
      res.status(401).send({ error: "Invalid Credentials" });
      return;
    }
    const allUsers = await User.find();
    res.json({
      adminName: adminExists.adminName,
      users: allUsers
    });
  } catch (error) {
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});
app.patch('/api/users/:id', async (req, res) => {
  try {
    const { access, admin } = req.body;
    const userId = req.params.id;

    const adminExists = await Admin.findOne({ adminName: admin });
    if (!adminExists) {
      return res.status(403).send({ error: "Unauthorized: Invalid Admin" });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { access },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const {
      fullName,
      fatherName,
      motherName,
      mobile,
      age,
      occupation,
      experience,
      salary,
      currentAddress,
      permanentAddress,
      photo1,
      photo2,
      height,
      message,
    } = req.body;

    // Check photo sizes (assuming they are sent as base64 strings)
    const isPhotoValid = (photo) => {
      const buffer = Buffer.from(photo, 'base64');
      return buffer.length < 100 * 1024; // 100 KB limit
    };

    if (!isPhotoValid(photo1) || !isPhotoValid(photo2)) {
      return res.status(400).send({ error: "Photos must be less than 100KB" });
    }

    const profile = new Profiles({
      fullName,
      fatherName,
      motherName,
      mobile,
      age,
      occupation,
      experience,
      salary,
      currentAddress,
      permanentAddress,
      photo1,
      photo2,
      height,
      message,
    });

    await profile.save();
    res.status(201).json(profile);
  } catch (error) {
    console.error("Error creating profile:", error);
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = await Profiles.find();
    res.json(profiles);
  } catch (error) {
    res.status(500).send({ error: error.message || 'An error occurred' });
  }
});

app.listen(5000, () => {
  console.log("server is running on 5000");
});

export const handler = Serverless(app);