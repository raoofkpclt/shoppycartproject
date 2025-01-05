const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        products: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
                name: { type: String , required: true},
                price: { type: Number, required: true },
                quantity: { type: Number, required: true },
                total: { type: Number, required: true },
            },
        ],
        totalAmount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
        paymentMethod: { type: String, enum: ['cod', 'card'], default: 'cod' },
        paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
        shippingAddress: { type: String, required: true },
    },
    {
        timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
    }
);

module.exports = mongoose.model('Order', orderSchema);
