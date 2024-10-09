import express from "express";
import mongoose from "mongoose";
import User from "./model.js";
import 'dotenv/config'
import cors from "cors";
import bodyParser from "body-parser";
import Serverless from "serverless-http";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*", credentials: true, }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.get("/", (req, res) => {
  res.send("server connected");
});

app.post('/api/users', async (req, res) => {
  const { id, name, picture, email } = req.body;
  
  try {
    let user = await User.findOne({ id });
    
    if (user) {
      return res.status(200).send(user);
    }
    user = new User({ id, name, picture, email  });
    await user.save();
    console.log(user);
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.listen(5000, () => {
  console.log("server is running on 5000");
});

export const handler = Serverless(app);