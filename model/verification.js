const mongoose =require('mongoose');
const Schema=mongoose.Schema

const otpVerificationSchema=new Schema({
    userId:String,
    otp:String,
    createdAt:Date,
    expireAt:Date,
});

const verification=mongoose.model(
    "verification",
    otpVerificationSchema

)
module.exports=verification