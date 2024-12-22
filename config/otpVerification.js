const nodemailer = require('nodemailer');


require('dotenv').config();

const sendOtpToEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS, 
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,                    
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 1 minute.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);
    } catch (error) {
        console.error(`Error sending OTP to ${email}:`, error);
        throw new Error('Could not send OTP email.');
    }
};

module.exports = sendOtpToEmail;
