require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_2026";
const BUCKET_NAME = 'cloudly';

// 1. Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.S3_SECRET_KEY || '');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- DEBUG LOGGER: This will show you exactly what is happening in Render Logs ---
app.use((req, res, next) => {
    console.log(`${req.method} request to: ${req.url}`);
    next();
});

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to MongoDB Atlas!");
});

// --- MODELS ---
const User = mongoose.model('User', {
    name: String, email: { type: String, unique: true }, password: { type: String },
    vaultPIN: String, otp: String, otpExpires: Date, storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 } 
});
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, s3Path: String, mimeType: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, sharedWith: [{ email: String, role: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: "No Token" });
        const token = authHeader.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const h = await bcrypt.hash(req.body.password, 10);
        await new User({ ...req.body, password: h }).save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Email already exists" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const u = await User.findOne({ email: req.body.email.toLowerCase().trim() });
        if (u && await bcrypt.compare(req.body.password, u.password)) {
            const token = jwt.sign({ id: u._id, email: u.email }, SECRET);
            res.json({ token, userName: u.name });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (e) { res.status(500).json({ error: "Login failed" }); }
});

// --- DRIVE ROUTES ---
app.get('/api/drive/storage', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    res.json({ used: u.storageUsed, limit: u.storageLimit });
});

app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab, vaultUnlocked } = req.query;
    let query = { owner: req.user.id };
    if (tab === 'starred') query.isStarred = true;
    else if (tab === 'vault') {
        if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Locked" });
        query.isVault = true;
    } else {
        query.isVault = false;
        query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
    }
    res.json({ folders: await Folder.find(query), files: await File.find(query) });
});

// --- SYSTEM ---
app.get('/', (req, res) => res.send("Cloudly API Live"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));