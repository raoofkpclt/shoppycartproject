const express=require('express');
const app=express();
const path=require('path');
const session=require('express-session');
const nocache=require('nocache');
require('dotenv').config();
const passport = require('passport');
require('./config/passport');
const adminRoutes=require('./routes/admin');
const userRoutes=require('./routes/user');
const connectDb=require('./db/connectDb');
const cors=require('cors')


//session use
app.use(nocache());
app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
}));

//view engine configaration
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');

//static file configaration 
app.use(express.static(path.join(__dirname,'public')));

app.use(express.urlencoded({extended:true}));
app.use(express.json());

//conect db
connectDb();

//cors
app.use(cors());

//use passport
app.use(passport.initialize());
app.use(passport.session());


//router middleware
app.use('/user',userRoutes);
app.use('/admin',adminRoutes);

//server port configaration 3002
const PORT=process.env.PORT||3002;
app.listen(PORT,()=>{
    console.log(`Your server running ${PORT} succesfully`);
});