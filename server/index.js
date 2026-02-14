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

const app = express();
const SECRET = process.env.JWT_SECRET || "REAL_DRIVE_PRO_2026";

// 1. Supabase S3 Setup
const minioClient = new Minio.Client({
    endPoint: (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0],
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1', pathStyle: true
});
const BUCKET_NAME = 'cloudly';

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// 2. SCHEMAS
const User = mongoose.model('User', { name: String, email: { type: String, unique: true }, password: String, vaultPIN: String, storageUsed: { type: Number, default: 0 } });
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, sharedWith: [{ email: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- ROUTES (FIXED ALL 404s) ---

app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: shared });
    } else { filter.isVault = false; filter.parentFolder = (folderId === "null" || !folderId) ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
    const Model = req.params.type === 'file' ? File : Folder;
    const item = await Model.findById(req.params.id);
    await Model.findByIdAndUpdate(req.params.id, { isStarred: !item.isStarred });
    res.json({ success: true });
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const { fileId, targetId } = req.body;
    await File.findByIdAndUpdate(fileId, { parentFolder: targetId === 'root' ? null : targetId });
    res.json({ success: true });
});

app.post('/api/drive/share', authenticate, async (req, res) => {
    const { fileId, email, hours } = req.body;
    const expiry = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await File.findByIdAndUpdate(fileId, { $push: { sharedWith: { email: email.toLowerCase(), expiresAt: expiry } } });
    res.json({ success: true });
});

app.delete('/api/drive/delete/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    if (file) {
        await minioClient.removeObject(BUCKET_NAME, file.path);
        await File.findByIdAndDelete(req.params.id);
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } });
    }
    res.json({ success: true });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed || 0, limit: 32212254720 }); // 30GB
});

// --- UPLOAD ---
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const tPath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.sendStatus(200);
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const key = `${req.body.uploadId}-${req.body.fileName}`;
    const tPath = path.join('/tmp', key);
    await minioClient.fPutObject(BUCKET_NAME, key, tPath);
    const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: key, parentFolder: req.body.folderId === "null" ? null : req.body.folderId, owner: req.user.id, isVault: req.body.isVault === 'true' });
    await file.save(); 
    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(tPath).size } });
    fs.unlinkSync(tPath); res.json(file);
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const f = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
});

app.listen(process.env.PORT || 5000, () => console.log("Backend Ready"));