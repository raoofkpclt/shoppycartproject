// const mongoose = require('mongoose');

// const orderSchema = new mongoose.Schema(
//     {
//         OrderId: { type: String, unique: true , sparse: true},
//         user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//         products: [
//             {
//                 productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
//                 name: { type: String , required: true},
//                 price: { type: Number, required: true },
//                 quantity: { type: Number, required: true },
//                 total: { type: Number, required: true },
//             },
//         ],
//         totalAmount: { type: Number, required: true },
//         couponDiscount: { type: Number, default:0},
//         status: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled','returned','returnRequested'], default: 'pending' },
//         paymentMethod: { type: String, enum: ['cod', 'card', 'razorpay'], default: 'cod' },
//         paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
//         returnReason: { type: String },
//         returnStatus: { type: String ,enum: ['pending','requested', 'rejected','accepted'], default:'pending' },
//         shippingAddress: { type: String, required: true },
//         cancelledAt: { type: Date },
//         deliveredAt: { type: Date },
//         razorpayOrderId: { type: String },
//         razorpayPaymentId: { type: String },
//         razorpaySignature: { type: String },
//     },
//     {
//         timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
//     }
// );

// module.exports = mongoose.model('Order', orderSchema);


const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        OrderId: { type: String, unique: true, sparse: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        products: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
                name: { type: String, required: true },
                price: { type: Number, required: true },
                quantity: { type: Number, required: true },
                total: { type: Number, required: true },
            },
        ],
        totalAmount: { type: Number, required: true },
        couponDiscount: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled', 'returned', 'returnRequested'], default: 'pending' },
        paymentMethod: { type: String, enum: ['cod', 'razorpay','wallet'], default: 'cod' },
        paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
        returnReason: { type: String },
        returnStatus: { type: String, enum: ['pending', 'requested', 'rejected', 'accepted'], default: 'pending' },
        shippingAddress: { type: String, required: true },
        cancelledAt: { type: Date },
        deliveredAt: { type: Date },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
    },
    {
        timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
    }
);
orderSchema.pre('save', function (next) {
    if (!this.OrderId) {
        this.OrderId = `ORDER-${Date.now()}`; // Example format
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
