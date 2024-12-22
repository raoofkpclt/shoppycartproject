// const mongoose = require('mongoose');

// const categorySchema = new mongoose.Schema({
//     name: {
//         type: String,
//         required: true,
//         unique: true, 
//     },
//     isActive: {
//         type: Boolean,
//         default: true, 
//     }
// }, {timestamps: true});

// // Enforcing unique index with case-insensitive search
// categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

// const Category = mongoose.model('Category', categorySchema);
// module.exports = Category;


const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, 
    },
    isActive: {
        type: Boolean,
        default: true, 
    }
}, {timestamps: true});

// Check if the index already exists, if not, define it
if (!categorySchema.paths['name']._index) {
    categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
}

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
