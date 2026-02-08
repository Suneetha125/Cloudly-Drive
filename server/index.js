require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Minio = require('minio');
const nodemailer = require('nodemailer');

const app = express();
const SECRET = process.env.JWT_SECRET || "FINAL_DRIVE_SECRET_2026";

// 1. Storage Setup
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '', 
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1', pathStyle: true
});
const BUCKET_NAME = 'cloudly';

// 2. Email Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, isVerified: { type: Boolean, default: false },
    otp: String, otpExpires: Date
});
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- AUTH & RECOVERY ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: "Email already registered. Please login." });
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        
        await transporter.sendMail({ to: email, subject: "Cloudly Verification", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "Signup failed. Try again." }); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "No account found with this email." });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    
    await transporter.sendMail({ to: email, subject: "Password Reset", text: `Your reset code: ${otp}` });
    res.json({ msg: "OTP Sent" });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid or expired OTP." });
    
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined; await user.save();
    res.json({ success: true });
});

app.post('/api/auth/verify', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
    user.isVerified = true; user.otp = undefined; await user.save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found. Please Sign Up." });
    if (!user.isVerified) return res.status(403).json({ error: "Unverified" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect password. Try again." });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
    res.json({ token, userName: user.name });
});

// --- REST OF DRIVE LOGIC (STORAGE, CONTENTS, UPLOAD, DELETE) ---
// (Keep the routes from the previous turn for storage, contents, upload, and delete)
// ... [Insert previous turn's Drive routes here] ...

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));