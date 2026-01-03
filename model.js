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
  mobile: { type: Number, required: true, unique: true },
  age: { type: Number, required: true },
  occupation: { type: String, required: true },
  experience: { type: String, required: true },
  salary: { type: String, required: true },
  currentAddress: { type: String, required: true },
  permanentAddress: { type: String, required: true },
  photo1: { type: String },
  photo2: { type: String },
  height: { type: String, required: true },
  message: { type: String }
});

const bioDataSchema = new mongoose.Schema({
  imageUrl: { type: String }, // Firebase URL
  data: [{
    label: { type: String },
    value: { type: String }
  }], // Array of dynamic fields
  birthYear: { type: Number, index: true }, // For filtering
  isMale: { type: Boolean, default: true }, // Gender tracking
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("user", userSchema);
const Admin = mongoose.model("admins", adminSchema);
const Profiles = mongoose.model("profiles", profileSchema);
const BioData = mongoose.model("biodatas", bioDataSchema);

export { Admin, User, Profiles, BioData };