// server.js (UPDATED)
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
const nodemailer = require('nodemailer'); // For password recovery, not initial signup verification

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026";
const BUCKET_NAME = 'cloudly'; // Ensure this bucket exists in your Supabase S3

// 1. Supabase S3 Setup - CRITICAL: Ensure S3_ENDPOINT is correct and Minio client can reach it.
// Supabase S3 endpoint usually looks like: [project-ref].supabase.co
// For Minio, you'd typically use just the host, and if pathStyle is true, it might prepend the bucket name.
// Let's ensure the endpoint parsing is robust.
const s3Host = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : '127.0.0.1'; // Extract hostname
const s3Port = process.env.S3_ENDPOINT && new URL(process.env.S3_ENDPOINT).port ? parseInt(new URL(process.env.S3_ENDPOINT).port) : 443;
const s3UseSSL = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).protocol === 'https:' : true;

const minioClient = new Minio.Client({
    endPoint: s3Host,
    port: s3Port,
    useSSL: s3UseSSL,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1', // Ensure region is correct for your Supabase bucket
    // pathStyle: true // Supabase S3 usually works better without pathStyle: true, or with virtual-hosted style
});

// Create bucket if it doesn't exist (only once on startup or when needed)
async function ensureBucketExists() {
    try {
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            await minioClient.makeBucket(BUCKET_NAME, process.env.S3_REGION || 'us-east-1');
            console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
        } else {
            console.log(`Bucket '${BUCKET_NAME}' already exists.`);
        }
    } catch (e) {
        console.error("Error ensuring bucket exists:", e.message);
        // Depending on error, might need to exit or flag readiness issue
    }
}
ensureBucketExists();


// 2. Email Setup - Fixed IPv6 Error for Render
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    family: 4 // This helps with IPv4 preference on some hosts
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB Cloud!"))
  .catch(err => console.log("Cloud Connection Error:", err));

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, 
    email: { type: String, unique: true, lowercase: true, trim: true }, // Ensure consistent email format
    password: String, 
    vaultPIN: String, 
    isVerified: { type: Boolean, default: true }, // Removed initial signup verification as per request
    otp: String, 
    otpExpires: Date, 
    storageUsed: { type: Number, default: 0 }
});
const Folder = mongoose.model('Folder', { 
    name: String, 
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    isStarred: { type: Boolean, default: false }, 
    isVault: { type: Boolean, default: false }, 
    isTrash: { type: Boolean, default: false } 
});
const File = mongoose.model('File', { 
    fileName: String, 
    fileSize: Number, 
    path: String, // Path in S3 bucket
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    isStarred: { type: Boolean, default: false }, 
    isVault: { type: Boolean, default: false }, 
    isTrash: { type: Boolean, default: false }, 
    sharedWith: [{ 
        email: { type: String, lowercase: true, trim: true }, 
        role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' }, 
        expiresAt: Date 
    }] 
});

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Authentication Denied: No token provided or invalid format.");
    }
    const token = authHeader.split(" ")[1];
    try { 
        req.user = jwt.verify(token, SECRET); 
        next(); 
    } catch (err) { 
        console.error("JWT Verification Error:", err.message);
        return res.status(401).send("Authentication Invalid: Invalid or expired token."); 
    }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required." });
        }
        const userEmail = email.toLowerCase().trim();
        const exists = await User.findOne({ email: userEmail });
        if (exists) {
            return res.status(400).json({ error: "An account with this email already exists." });
        }
        
        // Removed OTP verification for signup as requested
        const user = new User({ 
            name, 
            email: userEmail, 
            password: await bcrypt.hash(password, 10), 
            isVerified: true // User is immediately verified
        });
        await user.save(); 
        // Auto-login after registration for convenience
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
        res.status(201).json({ success: true, token, userName: user.name, message: "Registration successful!" });
    } catch (e) { 
        console.error("Signup error:", e);
        res.status(500).json({ error: "Registration failed due to a server error." }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        const userEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password." });
        }
        // If not verified and verification is enabled (currently disabled)
        // if (!user.isVerified) return res.status(403).json({ error: "Account not verified. Please check your email for OTP." });

        res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Login failed due to a server error." });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp; 
        user.otpExpires = Date.now() + 600000; // OTP valid for 10 minutes
        await user.save();
        await transporter.sendMail({ 
            from: process.env.EMAIL_USER,
            to: email, 
            subject: "Cloudly Password Recovery", 
            text: `Your Cloudly password reset code is: ${otp}\nThis code is valid for 10 minutes.` 
        });
        res.json({ message: "Password recovery OTP sent to your email." });
    } catch (e) {
        console.error("Forgot password error:", e);
        res.status(500).json({ error: "Failed to send OTP. Please try again later." });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "Email, OTP, and new password are required." });
        }
        const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined; // Clear OTP after successful reset
        user.otpExpires = undefined;
        await user.save();
        res.json({ success: true, message: "Password reset successful!" });
    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: "Failed to reset password. Please try again later." });
    }
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        // Find and delete all files owned by the user from S3 and MongoDB
        const files = await File.find({ owner: userId });
        for (let f of files) { 
            try { 
                await minioClient.removeObject(BUCKET_NAME, f.path); 
            } catch(e) {
                console.warn(`Could not delete S3 object ${f.path}:`, e.message);
            } 
        }
        await File.deleteMany({ owner: userId });
        await Folder.deleteMany({ owner: userId });
        await User.findByIdAndDelete(userId);
        res.json({ success: true, message: "Account and all associated data deleted." });
    } catch (e) {
        console.error("Account deletion error:", e);
        res.status(500).json({ error: "Failed to delete account. Please try again." });
    }
});

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let fileFilter = { owner: req.user.id };
    let folderFilter = { owner: req.user.id };

    if (tab === 'shared') {
        // Files shared *with* the current user
        const sharedFiles = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: sharedFiles.filter(f => {
            const access = f.sharedWith.find(a => a.email === req.user.email);
            return access && (!access.expiresAt || new Date() < access.expiresAt);
        })});
    } else if (tab === 'starred') {
        fileFilter.isStarred = true;
        folderFilter.isStarred = true;
    } else if (tab === 'trash') {
        fileFilter.isTrash = true;
        folderFilter.isTrash = true;
    } else if (tab === 'vault') {
        fileFilter.isVault = true;
        folderFilter.isVault = true;
    } else { // My Drive
        fileFilter.isVault = false;
        fileFilter.isTrash = false;
        fileFilter.parentFolder = folderId === "null" ? null : folderId;

        folderFilter.isVault = false;
        folderFilter.isTrash = false;
        folderFilter.parentFolder = folderId === "null" ? null : folderId;
    }

    try {
        const folders = await Folder.find(folderFilter);
        const files = await File.find(fileFilter);
        res.json({ folders, files });
    } catch (e) {
        console.error("Error fetching drive contents:", e);
        res.status(500).json({ error: "Failed