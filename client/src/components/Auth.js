const express = require('express');
const router = express.Router();
const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Minio = require('minio');

// 1. MinIO Setup for Deletion
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '',
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    pathStyle: true
});
const BUCKET_NAME = 'cloudly';

// 2. Nodemailer with IPv4 Fix for Render
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    family: 4 // <--- CRITICAL FIX FOR RENDER
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = async (email, otp) => {
    await transporter.sendMail({
        from: `"Cloudly Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Cloudly Security Code',
        text: `Your security code is ${otp}. It expires in 10 minutes.`,
    });
};

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) return res.status(400).json({ error: 'Account already exists' });

        const hashedPassword = await require('bcryptjs').hash(password, 10);
        user = new User({ email: email.toLowerCase(), password: hashedPassword, name });
        
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + 10 * 60 * 1000;
        await user.save();
        await sendOTP(email, otp);
        res.status(201).json({ message: 'OTP sent to email' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, userName: user.name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        if (!user.isVerified) {
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpiry = Date.now() + 10 * 60 * 1000;
            await user.save();
            await sendOTP(email, otp);
            return res.status(403).json({ error: 'Unverified', needsOTP: true });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, userName: user.name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + 10 * 60 * 1000;
        await user.save();
        await sendOTP(user.email, otp);
        res.json({ message: 'Recovery OTP sent' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }
        user.password = await require('bcryptjs').hash(newPassword, 10);
        user.otp = undefined;
        await user.save();
        res.json({ message: 'Success' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete Account (Recursive)
router.delete('/delete-account', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const files = await File.find({ owner: userId });
        for (const file of files) {
            try { await minioClient.removeObject(BUCKET_NAME, file.path); } catch(e){}
        }
        await File.deleteMany({ owner: userId });
        await Folder.deleteMany({ owner: userId });
        await User.findByIdAndDelete(userId);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found' });
        req.user = user;
        next();
    } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
}

module.exports = router;