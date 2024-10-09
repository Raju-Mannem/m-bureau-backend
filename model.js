import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, required: true, unique: true },
    picture: { type: String },
  });
const User=mongoose.model('user',userSchema);
export default User;