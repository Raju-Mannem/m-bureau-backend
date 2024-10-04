import mongoose from "mongoose";

let Registeruser=new mongoose.Schema({
    username:{
        type: String,
        require:    true
    },
    email:{
        type:   String,
        require:    true,
        unique: true
    },
    password:{
        type:   String,
        require:    true,
    },
    confirmpassword:{
        type:   String,
        require:    String
    }
})
const user=mongoose.model('user',Registeruser);
export default user;