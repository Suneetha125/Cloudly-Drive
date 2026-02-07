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
const pdf = require('pdf-parse');
const crypto = require('crypto');

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_ULTIMATE_SECRET_2026";

// 1. S3/Supabase Connection
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '127.0.0.1',
    port: process.env.S3_ENDPOINT ? 443 : 9000,
    useSSL: !!process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    region: process.env.S3_REGION || 'us-east-1'
});
const BUCKET_NAME = 'drive-clone';

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clouddrive_pro');

// 2. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, resetToken: String, resetExpiry: Date 
});
const Folder = mongoose.model('Folder', { 
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }
});
const File = mongoose.model('File', { 
    fileName: String, fileSize: Number, path: String, 
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, expiresAt: Date }]
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send("Denied");
    const pureToken = token.includes("Bearer ") ? token.split(" ")[1] : token;
    try { req.user = jwt.verify(pureToken, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Account exists" });

        const user = new User({ 
            ...req.body, 
            email, 
            password: await bcrypt.hash(req.body.password, 10) 
        });
        await user.save(); 
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
    res.json({ token, userName: user.name });
});
app.post('/api/auth/forgot-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token; user.resetExpiry = Date.now() + 3600000;
    await user.save(); res.json({ token });
});

// --- DRIVE FEATURES ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email.toLowerCase() });
        return res.json({ folders: [], files: shared.filter(f => !f.sharedWith.find(a => a.email === req.user.email.toLowerCase()).expiresAt || new Date() < f.sharedWith.find(a => a.email === req.user.email.toLowerCase()).expiresAt) });
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const files = await File.find({ owner: req.user.id });
    res.json({ used: files.reduce((acc, f) => acc + f.fileSize, 0), limit: 107374182400 });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ unlocked: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).send("Wrong");
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

// --- UPLOAD & DELETE ---
const upload = multer({ dest: 'temp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const t = path.join(__dirname, 'temp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(t, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.json({ success: true });
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const name = `${req.body.uploadId}-${req.body.fileName}`;
    const dest = path.join(__dirname, 'uploads', name);
    if(!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    fs.renameSync(path.join(__dirname, 'temp', name), dest);
    await minioClient.fPutObject(BUCKET_NAME, name, dest);
    const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(dest).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
    await file.save(); res.json(file);
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600) });
});

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));