const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    product: { type: String, required: true },
    brand: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    price: { type: Number, required: true },
    discountPercentage: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    description: { type: String, required: true },
    images: [String],
    isActive: { type: Boolean, default: true },
});

// Virtual field to calculate discounted price
productSchema.virtual('discountedPrice').get(function () {
    return this.price - (this.price * (this.discountPercentage / 100));
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
