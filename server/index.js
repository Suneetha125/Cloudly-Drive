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
const SECRET = process.env.JWT_SECRET || "CLOUDLY_ENTERPRISE_2026_KEY";
const BUCKET_NAME = 'cloudly';

// 1. S3/Supabase Configuration
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '', 
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    region: process.env.S3_REGION || 'us-east-1',
    pathStyle: true
});

// 2. Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI);

// 3. SCHEMAS
const UserSchema = new mongoose.Schema({
    name: String, email: { type: String, unique: true }, password: String,
    vaultPIN: String, isVerified: { type: Boolean, default: false },
    otp: String, otpExpires: Date, storageUsed: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

const Folder = mongoose.model('Folder', {
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }
});

const File = mongoose.model('File', {
    fileName: String, fileSize: Number, path: String, contentType: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

// 4. AUTH MIDDLEWARE
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- RECURSIVE DELETE HELPER ---
const deleteRecursive = async (folderId, permanent = false) => {
    const files = await File.find({ parentFolder: folderId });
    for (let f of files) {
        if (permanent) {
            try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){}
            await File.findByIdAndDelete(f._id);
        } else { await File.findByIdAndUpdate(f._id, { isTrash: true }); }
    }
    const subs = await Folder.find({ parentFolder: folderId });
    for (let s of subs) await deleteRecursive(s._id, permanent);
    if (permanent) await Folder.findByIdAndDelete(folderId);
    else await Folder.findByIdAndUpdate(folderId, { isTrash: true });
};

// --- ROUTES ---

// Auth & OTP
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        await transporter.sendMail({ to: email, subject: "Cloudly Verification", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "Account exists" }); }
});

app.post('/api/auth/verify', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
    user.isVerified = true; user.otp = undefined; await user.save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user || !user.isVerified || !(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ error: "Invalid credentials or unverified" });
    res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
});

// Drive Contents
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email, $or: [{"sharedWith.expiresAt": {$gt: new Date()}}, {"sharedWith.expiresAt": null}] });
        return res.json({ folders: [], files: shared });
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

// Parallel Chunk Upload
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
        if (user.storageUsed + stats.size > 32212254720) return res.status(400).json({ error: "Storage Limit (30GB) Exceeded" });

        await minioClient.fPutObject(BUCKET_NAME, name, tPath);
        const file = new File({ fileName: req.body.fileName, fileSize: stats.size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
        await file.save();
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: stats.size } });
        fs.unlinkSync(tPath);
        res.json(file);
    } catch (err) { res.status(500).json({ error: "Cloud upload failed" }); }
});

// Preview & Move
app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const f = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const Model = req.body.type === 'file' ? File : Folder;
    await Model.findByIdAndUpdate(req.body.itemId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId, isVault: req.body.toVault });
    res.json({ success: true });
});

app.listen(5000, () => console.log("Cloudly Enterprise Backend Active"));