const mongoose = require('mongoose');

// Define the schema using mongoose.Schema
const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        image: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        }
    }]
});

// Create the model
const Wishlist = mongoose.model("Wishlist", wishlistSchema);

// Export the model
module.exports = Wishlist;
