import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  googleId: { type: String, required: true },
  access: { type: Boolean, default: false },
  payment: { type: Boolean, default: false }
});
const adminSchema = new mongoose.Schema({
  adminName: { type: String, required: true },
  password: { type: String, required: true },
});

const profileSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  fatherName: { type: String, required: true },
  motherName: { type: String, required: true },
  mobile: { type: String, required: true },
  age: { type: Number, required: true },
  occupation: { type: String, required: true },
  experience: { type: String, required: true },
  salary: { type: Number, required: true },
  currentAddress: { type: String, required: true },
  permanentAddress: { type: String, required: true },
  photo1: { type: String, required: true },
  photo2: { type: String, required: true }, 
  height: { type: String, required: true },
  message: { type: String, required: false },
});

const User = mongoose.model("user", userSchema);
const Admin = mongoose.model("admins", adminSchema);
const Profiles = mongoose.model("profiles", profileSchema);
export { Admin, User, Profiles};