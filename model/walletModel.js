const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    transactions: [
        {
            amount: { type: Number, required: true },
            type: { type: String, enum: ["credit", "debit"], required: true },
            date: { type: Date, default: Date.now },
        },
    ],
});

// Sort transactions by date descending whenever a wallet is fetched
walletSchema.pre("findOne", function () {
    this.sort({ "transactions.date": -1 });
  });

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;





// const walletSchema=new mongoose.Schema({
//     userId:{
//         type:mongoose.Schema.Types.ObjectId,
//         ref:"User",
//         required:true
//     },
//     balance:{
//         type:Number,
//         default:0
//     }
// })

// const Wallet=mongoose.model("Wallet", walletSchema)
// module.exports=Wallet