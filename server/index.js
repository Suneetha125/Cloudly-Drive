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
const crypto = require('crypto');

const app = express();
const SECRET = process.env.JWT_SECRET || "REAL_DRIVE_PRO_2026";

// 1. Supabase S3 Setup
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '', 
    port: 443,
    useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    region: process.env.S3_REGION || 'us-east-1',
    pathStyle: true
});
const BUCKET_NAME = 'cloudly';

// 2. Email Setup for OTP
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
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, hours: Number, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- AUTH & PASSWORD RECOVERY ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: "Account already exists" });
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        
        await transporter.sendMail({ to: email, subject: "Cloudly OTP", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "Registration failed" }); }
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
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(400).json({ error: "Please verify your email first" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
    res.json({ token, userName: user.name });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    await transporter.sendMail({ to: email, subject: "Password Reset OTP", text: `Your reset code: ${otp}` });
    res.json({ msg: "OTP Sent" });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid or expired OTP" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined; await user.save();
    res.json({ success: true });
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    const files = await File.find({ owner: userId });
    for (let f of files) { try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){} }
    await File.deleteMany({ owner: userId });
    await Folder.deleteMany({ owner: userId });
    await User.findByIdAndDelete(userId);
    res.json({ success: true });
});

// --- VAULT ---
app.get('/api/vault/status', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ hasPIN: !!user.vaultPIN });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ unlocked: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).send("Wrong PIN");
});

// --- FILE MANAGEMENT ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const user = await User.findById(req.user.id);
        const shared = await File.find({ "sharedWith.email": user.email.toLowerCase() });
        return res.json({ folders: [], files: shared.filter(f => {
            const acc = f.sharedWith.find(a => a.email === user.email.toLowerCase());
            return !acc.expiresAt || new Date() < acc.expiresAt;
        })});
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.patch('/api/files/move', authenticate, async (req, res) => {
    await File.findByIdAndUpdate(req.body.fileId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ msg: "Moved" });
});

app.post('/api/files/share', authenticate, async (req, res) => {
    const expiry = req.body.hours > 0 ? new Date(Date.now() + req.body.hours * 3600000) : null;
    await File.findByIdAndUpdate(req.body.fileId, { $push: { sharedWith: { email: req.body.email.toLowerCase(), expiresAt: expiry } } });
    res.json({ msg: "OK" });
});

// --- UPLOAD & STORAGE ---
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const tPath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.json({ success: true });
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    try {
        const name = `${req.body.uploadId}-${req.body.fileName}`;
        const tPath = path.join('/tmp', name);
        await minioClient.fPutObject(BUCKET_NAME, name, tPath);
        const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
        await file.save(); fs.unlinkSync(tPath); res.json(file);
    } catch (err) { res.status(500).json({ error: "Cloud storage failed" }); }
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const files = await File.find({ owner: req.user.id });
    const used = files.reduce((acc, f) => acc + f.fileSize, 0);
    res.json({ used, limit: 32212254720 }); // 30GB
});

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));