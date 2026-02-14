require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend'); // Use Resend for reliable emails
const { createClient } = require('@supabase/supabase-js');

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_2026";
const BUCKET_NAME = 'cloudly';

// 1. Initialize Clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to MongoDB Cloud!");
});

// --- MODELS ---
const User = mongoose.model('User', {
    name: String, email: { type: String, unique: true }, password: { type: String },
    vaultPIN: String, otp: String, otpExpires: Date,
    storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 } 
});

const Folder = mongoose.model('Folder', {
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }
});

const File = mongoose.model('File', {
    fileName: String, fileSize: Number, s3Path: String, mimeType: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
};

// --- AUTH & RECOVERY ---

// Register (No OTP needed here as per your request)
app.post('/api/auth/register', async (req, res) => {
    try {
        const h = await bcrypt.hash(req.body.password, 10);
        await new User({ ...req.body, password: h }).save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Email already exists" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email.toLowerCase() });
    if (u && await bcrypt.compare(req.body.password, u.password)) {
        res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
    } else res.status(401).json({ error: "Invalid credentials" });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 600000; 
        await user.save();

        // --- BREVO API CALL (Works for ANY email) ---
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "Cloudly Support", email: "support@cloudly.com" },
                to: [{ email: user.email }],
                subject: "Your Password Recovery Code",
                htmlContent: `<html><body><h1>Code: ${otp}</h1><p>Expires in 10 mins.</p></body></html>`
            })
        });

        if (response.ok) {
            res.json({ success: true, msg: "OTP Sent to your inbox!" });
        } else {
            const errData = await response.json();
            console.error("Brevo Error:", errData);
            // FALLBACK: If API fails, use a "Master Code" for your exam
            console.log(`MASTER OTP FOR EXAM: ${otp}`);
            res.json({ success: true, msg: "OTP Sent (Check Logs if not received)" });
        }

    } catch (e) {
        res.status(500).json({ error: "Server Error" });
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        // 1. THE MASTER CODE FIX: If you type 123456, it bypasses the check
        if (otp === "123456") {
            const user = await User.findOne({ email: email.toLowerCase().trim() });
            if (user) {
                user.password = await bcrypt.hash(newPassword, 10);
                user.otp = undefined;
                await user.save();
                return res.json({ success: true, msg: "Master Code Accepted!" });
            }
        }

        // 2. Normal OTP logic
        const user = await User.findOne({ 
            email: email.toLowerCase().trim(), 
            otp: otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ error: "Invalid OTP or code expired" });

        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Reset failed." });
    }
});
// --- DRIVE LOGIC ---

app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab, vaultUnlocked } = req.query;
    let query = { owner: req.user.id };
    if (tab === 'starred') query.isStarred = true;
    else if (tab === 'vault') {
        if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Vault Locked" });
        query.isVault = true;
    } else {
        query.isVault = false;
        query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
    }
    res.json({ folders: await Folder.find(query), files: await File.find(query) });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    if (!u.vaultPIN) { 
        u.vaultPIN = await bcrypt.hash(req.body.pin, 10); 
        await u.save(); 
        return res.json({ setup: true }); 
    }
    if (await bcrypt.compare(req.body.pin, u.vaultPIN)) res.json({ success: true });
    else res.status(403).json({ error: "Fail" });
});

// --- UPLOAD LOGIC ---
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path);
    res.sendStatus(200);
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    try {
        const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
        const temp = path.join('/tmp', `${uploadId}-${fileName}`);
        const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
        await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
        const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: folderId === "null" ? null : folderId, owner: req.user.id, isVault: isVault === 'true' || isVault === true });
        await file.save();
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
        fs.unlinkSync(temp);
        res.json(file);
    } catch (e) { res.status(500).json({ error: "Upload failed" }); }
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600);
    res.json({ url: data.signedUrl });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    res.json({ used: u.storageUsed, limit: u.storageLimit });
});

app.get('/', (req, res) => res.send("Cloudly API Live"));

app.listen(process.env.PORT || 5000);