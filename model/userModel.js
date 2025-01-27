const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, unique: true ,sparse: true},
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String},
    isAdmin: { type: Boolean, required: true, default: false },
    isBlocked: { type: Boolean, required: true, default: false },
    referralCode: { type: String, unique: true, sparse: true, default: null },

});

// categorySchema.index({ name: 1 }); 

userSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        let code;
        let exists;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate random code
            exists = await mongoose.models.user.findOne({ referralCode: code });
        } while (exists);
        this.referralCode = code;
    }
    next();
});


userSchema.statics.generateReferralCode = async function () {
    let code;
    let exists;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase(); 
        exists = await this.findOne({ referralCode: code });
    } while (exists);
    return code;
};

module.exports = mongoose.model("User", userSchema);
