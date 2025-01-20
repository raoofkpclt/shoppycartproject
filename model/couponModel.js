const mongoose = require('mongoose');

const couponSchema=new mongoose.Schema({
    code:{
        type:String,
        required:true,
        unique:true
    },
    minPurchase:{
        type:Number,
        required:true
    },
    discountPercentage:{
        type:Number,
        required:true
    },
    maxDiscount:{
        type:Number,
        required:true
    },
    isActive:{
        type:Boolean,
        required:true,
        default:true
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        required:true
    },
    // usageLimit: {
    //     type: Number,
    //     default: 1
    // },
    description:{
        type:String,
        required:true
    }
},{ timestamps: true });

module.exports=mongoose.model('Coupon',couponSchema)

