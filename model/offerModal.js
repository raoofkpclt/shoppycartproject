const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    applicableProducts: [
        {
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Product'
        }
    ],
    applicableCategories: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        }
    ],
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Create the Offer model
const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
