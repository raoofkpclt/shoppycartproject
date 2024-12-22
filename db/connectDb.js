const mongoose=require('mongoose');

const connectDb=async()=>{
    try {
        const connect=await mongoose.connect('mongodb://localhost:27017/shoppycart',{});
        console.log(`MongoDB Connected ${connect.connection.host}`);
    } catch (error) {
        console.log('there are some error',error);
        process.exit(1);
    }
}

module.exports=connectDb;