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
const SECRET = process.env.JWT_SECRET || "REAL_DRIVE_PRO_2026";

// 1. Supabase S3 Setup (Fixed Endpoint Logic)
const s3Host = (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0];
const minioClient = new Minio.Client({
    endPoint: s3Host || '127.0.0.1', 
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1', pathStyle: true
});
const BUCKET_NAME = 'cloudly';

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
const User = mongoose.model('User', { name: String, email: { type: String, unique: true }, password: String, vaultPIN: String, storageUsed: { type: Number, default: 0 } });
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, role: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- ROUTES ---

// Manage Access (Share with Role & Expiry)
app.post('/api/files/share', authenticate, async (req, res) => {
    const { fileId, email, role, hours } = req.body;
    const expiryDate = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await File.findByIdAndUpdate(fileId, { 
        $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiryDate } } 
    });
    res.json({ msg: "Shared" });
});

// Create Folder
app.post('/api/drive/folder', authenticate, async (req, res) => {
    const folder = new Folder({ ...req.body, owner: req.user.id });
    await folder.save(); res.json(folder);
});

// Contents (Handles Shared Tab)
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: shared.filter(f => {
            const acc = f.sharedWith.find(a => a.email === req.user.email);
            return !acc.expiresAt || new Date() < acc.expiresAt;
        })});
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

// Parallel Upload Logic
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const tPath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.json({ success: true });
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const name = `${req.body.uploadId}-${req.body.fileName}`;
    const tPath = path.join('/tmp', name);
    try {
        await minioClient.fPutObject(BUCKET_NAME, name, tPath);
        const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
        await file.save(); 
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: file.fileSize } });
        fs.unlinkSync(tPath); res.json(file);
    } catch (err) { res.status(500).send("Upload failed"); }
});

// Storage (30GB Limit)
app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: 32212254720 });
});

// Account Deletion
app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    const files = await File.find({ owner: userId });
    for (let f of files) { try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){} }
    await File.deleteMany({ owner: userId }); await Folder.deleteMany({ owner: userId }); await User.findByIdAndDelete(userId);
    res.json({ success: true });
});

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));
