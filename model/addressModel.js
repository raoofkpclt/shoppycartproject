const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addresses: [
        {
            name: { type: String, required: true },
            phone: { type: String, required: true },
            pincode: { type: String, required: true },
            locality: { type: String, required: true },
            city: { type: String, required: true },
            state: { type: String, required: true },
            address: { type: String, required: true },
            landmark: { type: String },
            alternatePhone: { type: String },
        }
    ],
});

module.exports = mongoose.model('Address', addressSchema);