import express from "express";
import mongoose from "mongoose";
import { Admin, User, Profiles, BioData } from "./model.js";
import { auth } from "./middleware.js";
import "dotenv/config";
import cors from "cors";
import Serverless from "serverless-http";
import bodyParser from "body-parser";
import multer from "multer";
import admin from "firebase-admin";
import helmet from "helmet";
import morgan from "morgan";
import { v4 as uuid } from "uuid";

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const bucket = admin.storage().bucket();
const app = express();

app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan("combined"));

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
      profiles = await Profiles.find({},
        { fullName: 1, age: 1, occupation: 1, currentAddress: 1 }
      );
      res.status(200).json({ user, profiles });
    }
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

      if (
        !fullName ||
        !fatherName ||
        !motherName ||
        !mobile ||
        !age ||
        !occupation ||
        !experience ||
        !salary ||
        !currentAddress ||
        !permanentAddress ||
        !height
      ) {
        return res.status(400).send({ error: "All fields are required" });
      }

      const photo1 = req.files["photo1"] ? req.files["photo1"][0] : null;
      const photo2 = req.files["photo2"] ? req.files["photo2"][0] : null;

      if (!photo1 || !photo2) {
        return res.status(400).send({ error: "Both photos are required" });
      }

      const uploadFile = (file) => {
        const blob = bucket.file(uuid() + "-" + file.originalname);
        const blobStream = blob.createWriteStream({
          metadata: {
            contentType: file.mimetype,
          },
        });

        return new Promise((resolve, reject) => {
          blobStream.on("error", reject);
          blobStream.on("finish", async () => {
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name
              }/o/${encodeURIComponent(blob.name)}?alt=media`;
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
      res
        .status(500)
        .send({
          error:
            error.message || "An error occurred while uploading the profile",
        });
    }
  }
);

app.get("/api/profiles", async (req, res) => {
  try {
    const profiles = await Profiles.find(
      {},
      { fullName: 1, age: 1, occupation: 1, currentAddress: 1 }
    );
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
  const userId = req.params.id;
  try {
    // Find and delete the user
    const user = await Profiles.findByIdAndDelete(userId);
    if (!user) return res.status(404).send("User not found");

    // Delete images
    const deleteImage = async (imageUrl) => {
      const pathStartIndex = imageUrl.indexOf("/o/") + 3;
      const pathEndIndex = imageUrl.indexOf("?");
      const path = imageUrl.substring(pathStartIndex, pathEndIndex);
      await bucket.file(decodeURIComponent(path)).delete();
    };

    await Promise.all([deleteImage(user.photo1), deleteImage(user.photo2)]);
    res.status(200).send("User and images deleted");
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message || "An error occurred" });
  }
});

app.post("/api/ai/extract-bio-data", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY missing in backend");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
        max_tokens: 1024,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: `
You extract bio-data from text into JSON.
The JSON MUST have this exact structure:
{
  "items": [
    { "label": "string", "value": "string" }
  ]
}

Do not add extra keys.
Do not wrap in markdown.
Do not add explanations.
            `.trim(),
          },
          {
            role: "user",
            content: `Extract bio-data from the following text:\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API Error:", response.status, errText);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const result = await response.json();
    const output = result.choices?.[0]?.message?.content || "";

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(output);
    } catch {
      parsedOutput = { items: [], raw: output };
    }
    res.json(parsedOutput);

  } catch (error) {
    console.error("AI Proxy Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during AI processing",
    });
  }
});



// --- BioData Endpoints ---

app.post(
  "/api/biodata",
  upload.single("image"), // Expect 'image' file
  async (req, res) => {
    try {
      const { data, isMale } = req.body; // 'data' is JSON string of fields

      const parsedData = JSON.parse(data);
      const parsedIsMale = isMale === 'true' || isMale === true;

      let imageUrl = null;
      if (req.file) {
        // Upload to Firebase
        const blob = bucket.file(uuid() + "-" + req.file.originalname);
        const blobStream = blob.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
          },
        });

        await new Promise((resolve, reject) => {
          blobStream.on("error", reject);
          blobStream.on("finish", async () => {
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name
              }/o/${encodeURIComponent(blob.name)}?alt=media`;
            imageUrl = publicUrl;
            resolve();
          });
          blobStream.end(req.file.buffer);
        });
      }

      // Extract Birth Year
      let birthYear = null;
      const dobField = parsedData.find(item =>
        item.label.toLowerCase().includes("date of birth") ||
        item.label.toLowerCase().includes("dob")
      );

      if (dobField && dobField.value) {
        const yearMatch = dobField.value.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          birthYear = parseInt(yearMatch[0], 10);
        }
      }

      const bioData = new BioData({
        imageUrl,
        data: parsedData,
        birthYear,
        isMale: parsedIsMale
      });

      await bioData.save();
      res.status(201).json(bioData);

    } catch (error) {
      console.error("BioData Save Error:", error);
      res.status(500).send({ error: error.message || "Failed to save BioData" });
    }
  }
);

app.put(
  "/api/biodata/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { data, isMale } = req.body;

      const parsedData = JSON.parse(data);
      const parsedIsMale = isMale === 'true' || isMale === true;

      // Find existing to handle image replacement
      const existingBioData = await BioData.findById(id);
      if (!existingBioData) return res.status(404).send({ error: "BioData not found" });

      let imageUrl = existingBioData.imageUrl;

      if (req.file) {
        // Delete old image if exists
        if (existingBioData.imageUrl) {
          try {
            const pathStartIndex = existingBioData.imageUrl.indexOf("/o/") + 3;
            const pathEndIndex = existingBioData.imageUrl.indexOf("?");
            const path = existingBioData.imageUrl.substring(pathStartIndex, pathEndIndex);
            await bucket.file(decodeURIComponent(path)).delete();
          } catch (e) { console.error("Error deleting old image", e); }
        }

        // Upload new image
        const blob = bucket.file(uuid() + "-" + req.file.originalname);
        const blobStream = blob.createWriteStream({
          metadata: { contentType: req.file.mimetype },
        });

        await new Promise((resolve, reject) => {
          blobStream.on("error", reject);
          blobStream.on("finish", async () => {
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;
            imageUrl = publicUrl;
            resolve();
          });
          blobStream.end(req.file.buffer);
        });
      }

      // Extract Birth Year (Re-calc)
      let birthYear = existingBioData.birthYear;
      const dobField = parsedData.find(item =>
        item.label.toLowerCase().includes("date of birth") ||
        item.label.toLowerCase().includes("dob")
      );
      if (dobField && dobField.value) {
        const yearMatch = dobField.value.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) birthYear = parseInt(yearMatch[0], 10);
      }

      existingBioData.data = parsedData;
      existingBioData.birthYear = birthYear;
      existingBioData.isMale = parsedIsMale;
      existingBioData.imageUrl = imageUrl;

      await existingBioData.save();
      res.status(200).json(existingBioData);

    } catch (error) {
      console.error("BioData Update Error:", error);
      res.status(500).send({ error: error.message || "Failed to update BioData" });
    }
  }
);

app.delete("/api/biodata/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bioData = await BioData.findById(id);
    if (!bioData) return res.status(404).json({ error: "Not found" });

    if (bioData.imageUrl) {
      try {
        const pathStartIndex = bioData.imageUrl.indexOf("/o/") + 3;
        const pathEndIndex = bioData.imageUrl.indexOf("?");
        const path = bioData.imageUrl.substring(pathStartIndex, pathEndIndex);
        await bucket.file(decodeURIComponent(path)).delete();
      } catch (e) { console.error("Error deleting image from Firebase", e); }
    }

    await BioData.findByIdAndDelete(id);
    res.status(200).send({ message: "BioData deleted successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/biodata/years", async (req, res) => {
  try {
    const years = await BioData.distinct("birthYear");
    // Filter out nulls and sort
    const sortedYears = years.filter(y => y != null).sort((a, b) => a - b);
    res.json(sortedYears);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/biodata", async (req, res) => {
  try {
    const { year } = req.query;
    let query = {};
    if (year) {
      query.birthYear = parseInt(year);
    }
    const profiles = await BioData.find(query).sort({ createdAt: -1 });
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/biodata/:id", async (req, res) => {
  try {
    const profile = await BioData.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(5000, () => {
  console.log("server is running on 5000");
});

export const handler = Serverless(app);
