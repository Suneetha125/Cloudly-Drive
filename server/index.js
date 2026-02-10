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
const pdf = require('pdf-parse'); 

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_ULTIMATE_2026";
const BUCKET_NAME = 'cloudly';

// 1. Supabase S3 Setup
const minioClient = new Minio.Client({
    endPoint: (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0],
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1', pathStyle: true
});

// 2. Email Setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    family: 4 
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, isVerified: { type: Boolean, default: false },
    otp: String, otpExpires: Date, storageUsed: { type: Number, default: 0 }
});
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, role: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        await transporter.sendMail({ to: email, subject: "Cloudly OTP", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "User exists" }); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    await transporter.sendMail({ to: user.email, subject: "Recovery Code", text: `Your code: ${otp}` });
    res.json({ msg: "OTP Sent" });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
    user.password = await bcrypt.hash(req.body.newPassword, 10);
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
    const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Unverified" });
    if (!(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ error: "Wrong password" });
    res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    const files = await File.find({ owner: userId });
    for (let f of files) { try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){} }
    await File.deleteMany({ owner: userId }); await Folder.deleteMany({ owner: userId }); await User.findByIdAndDelete(userId);
    res.json({ success: true });
});

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: shared });
    }
    if (folderId && folderId !== "null") filter.parentFolder = folderId;
    else {
        filter.parentFolder = null;
        if (tab === 'starred') filter.isStarred = true;
        else if (tab === 'vault') filter.isVault = true;
        else if (tab === 'trash') filter.isTrash = true;
        else { filter.isVault = false; filter.isTrash = false; }
    }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.post('/api/drive/folder', authenticate, async (req, res) => {
    const folder = new Folder({ ...req.body, owner: req.user.id });
    await folder.save(); res.json(folder);
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const Model = req.body.type === 'file' ? File : Folder;
    await Model.findByIdAndUpdate(req.body.itemId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId, isVault: req.body.toVault || false });
    res.json({ success: true });
});

app.post('/api/drive/share', authenticate, async (req, res) => {
    const expiry = req.body.hours ? new Date(Date.now() + parseInt(req.body.hours) * 3600000) : null;
    await File.findByIdAndUpdate(req.body.fileId, { $push: { sharedWith: { email: req.body.email.toLowerCase(), role: req.body.role, expiresAt: expiry } } });
    res.json({ success: true });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: 32212254720 }); // 30GB
});

// --- UPLOAD & PREVIEW ---
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const tPath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.json({ success: true });
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const key = `${req.body.uploadId}-${req.body.fileName}`;
    const tPath = path.join('/tmp', key);
    await minioClient.fPutObject(BUCKET_NAME, key, tPath);
    const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: key, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === true });
    await file.save(); 
    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(tPath).size } });
    fs.unlinkSync(tPath); res.json(file);
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const f = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ success: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ success: true });
    else res.status(403).json({error: "Wrong PIN"});
});

app.listen(process.env.PORT || 5000, () => console.log("Cloudly Engine Running"));