import express from "express";
import mongoose from "mongoose";
import { Admin, User, Profiles } from "./model.js";
import { auth } from "./middleware.js";
import "dotenv/config";
import cors from "cors";
import Serverless from "serverless-http";
import bodyParser from "body-parser";
import multer from "multer";
import admin from "firebase-admin";
import helmet from "helmet";
import morgan from "morgan";
import {v4 as uuid} from 'uuid';

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();
const app = express();

app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan('combined'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("server connected");
});

app.post("/api/users", auth, async (req, res) => {
  const { email, id: googleId } = req.user;
  let profiles = null;
  try {
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await new User({ email, googleId }).save();
    }
    if (user.access === true) {
      profiles = await Profiles.find();
    }
    res.json({ user, profiles });
  } catch (error) {
    res.status(400).send({ error: error.message || "An error occurred" });
  }
});

app.post("/api/adminlogin", async (req, res) => {
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
      users: allUsers,
    });
  } catch (error) {
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});

app.patch("/api/users/:id", async (req, res) => {
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

app.post(
  "/api/profiles",
  upload.fields([{ name: "photo1" }, { name: "photo2" }]),
  async (req, res) => {
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
        height,
        message,
      } = req.body;

      // Validate required fields
      if (!fullName || !fatherName || !motherName || !mobile || !age || !occupation || !experience || !salary || !currentAddress || !permanentAddress || !height) {
        return res.status(400).send({ error: "All fields are required" });
      }

      const photo1 = req.files["photo1"] ? req.files["photo1"][0] : null;
      const photo2 = req.files["photo2"] ? req.files["photo2"][0] : null;

      if (!photo1 || !photo2) {
        return res.status(400).send({ error: "Both photos are required" });
      }

      const uploadFile = (file) => {
        const blob = bucket.file(uuid() + '-' + file.originalname);
        const blobStream = blob.createWriteStream({
          metadata: {
            contentType: file.mimetype
          }
        });

        return new Promise((resolve, reject) => {
          blobStream.on('error', reject);
          blobStream.on('finish', async () => {
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;
            resolve(publicUrl);
          });
          blobStream.end(file.buffer);
        });
      };

      const photo1Url = await uploadFile(photo1);
      const photo2Url = await uploadFile(photo2);

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
        photo1: photo1Url,
        photo2: photo2Url,
        height,
        message,
      });

      await profile.save();
      res.status(201).send({ message: "Profile uploaded successfully" });
    } catch (error) {
      res.status(500).send({ error: error.message || "An error occurred while uploading the profile" });
    }
  }
);

app.get("/api/profiles", async (req, res) => {
  try {
    const profiles = await Profiles.find({}, { fullName: 1, age: 1, occupation: 1, currentAddress: 1 });
    res.status(200).json(profiles);
  } catch (error) {
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});
 
app.get("/api/profiles/:id", async (req, res) => {
  try {
    const profile = await Profiles.findById(req.params.id);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});

app.delete("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await Profiles.findByIdAndDelete(req.params.id);
      res.status(200).json(profile);
    } catch (error) {
      res.status(500).send({ error: error.message || "An error occurred" });
    }
  });  

app.listen(5000, () => {
  console.log("server is running on 5000");
});

export const handler = Serverless(app);
