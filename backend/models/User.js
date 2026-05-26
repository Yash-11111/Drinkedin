const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true },
  username:  String,
  avatarUrl: { type: String, default: null },
  avatarPublicId: { type: String, default: null },
  avatarType:{type:String,default:"default"},
  headline:{type:String,default:""},
  location:{type:String,default:""},
  bio:{type:String,default:""},
  followers:{type:[String],default:[]},
  following:{type:[String],default:[]},
  savedPosts:{type:[String],default:[]},
  otp:       String,
  otpExpiry: Date
});

module.exports = mongoose.model("User", userSchema);
