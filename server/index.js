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

const User = require('./models/User');
const Folder = require('./models/Folder');
const File = require('./models/File');

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_ULTIMATE_2026";
const BUCKET_NAME = 'cloudly';

// 1. S3 Setup
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '',
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1', pathStyle: true
});

// 2. Email Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).json({ error: "Invalid Session" }); }
};

// --- AUTH & IDENTITY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        await transporter.sendMail({ to: email, subject: "Cloudly OTP", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "User already exists" }); }
});

app.post('/api/auth/verify', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
    user.isVerified = true; user.otp = undefined; await user.save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Unverified" });
    if (!(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ error: "Wrong password" });
    res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    await transporter.sendMail({ to: user.email, subject: "Reset Password", text: `Reset code: ${otp}` });
    res.json({ msg: "Sent" });
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

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: shared.filter(f => !f.sharedWith.find(a => a.email === req.user.email).expiresAt || new Date() < f.sharedWith.find(a => a.email === req.user.email).expiresAt) });
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: 32212254720 }); // 30GB
});

// --- UPLOAD ---
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
        const stats = fs.statSync(tPath);
        const user = await User.findById(req.user.id);
        if (user.storageUsed + stats.size > 32212254720) return res.status(400).json({ error: "Storage Full" });

        await minioClient.fPutObject(BUCKET_NAME, name, tPath);
        const file = new File({ fileName: req.body.fileName, fileSize: stats.size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
        await file.save();
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: stats.size } });
        fs.unlinkSync(tPath); res.json(file);
    } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

// --- ACTIONS ---
app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ unlocked: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).json({ error: "Wrong PIN" });
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const Model = req.body.type === 'file' ? File : Folder;
    await Model.findByIdAndUpdate(req.body.itemId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ success: true });
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const f = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
});

app.listen(process.env.PORT || 5000, () => console.log("Cloudly Engine V11 Live"));