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

// 1. S3/Cloud Storage Setup
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '127.0.0.1',
    port: process.env.S3_ENDPOINT ? 443 : 9000,
    useSSL: !!process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    pathStyle: true
});
const BUCKET_NAME = 'cloudly';

// 2. Email Transporter for OTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clouddrive_pro');

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, isVerified: { type: Boolean, default: false },
    otp: String, otpExpires: Date
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
    sharedWith: [{ email: String, role: String, expiresAt: Date }] // role: 'Viewer' or 'Editor'
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send("Denied");
    const pureToken = token.includes("Bearer ") ? token.split(" ")[1] : token;
    try { req.user = jwt.verify(pureToken, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- AUTH & IDENTITY VERIFICATION ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        await transporter.sendMail({ to: email, subject: "Cloudly Verification Code", text: `Your code is: ${otp}` });
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

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    const files = await File.find({ owner: userId });
    for (let f of files) { try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){} }
    await File.deleteMany({ owner: userId });
    await Folder.deleteMany({ owner: userId });
    await User.findByIdAndDelete(userId);
    res.json({ success: true });
});

// --- VAULT & BIOMETRICS ---
app.get('/api/vault/status', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ hasPIN: !!user.vaultPIN });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { 
        user.vaultPIN = await bcrypt.hash(req.body.pin, 10); 
        await user.save(); 
        return res.json({ unlocked: true, setup: true }); 
    }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).send("Wrong PIN");
});

// --- FILE MANAGEMENT (MOVE, STAR, TRASH) ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email.toLowerCase() });
        return res.json({ folders: [], files: shared.filter(f => {
            const acc = f.sharedWith.find(a => a.email === req.user.email.toLowerCase());
            return !acc.expiresAt || new Date() < acc.expiresAt;
        })});
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.patch('/api/files/move', authenticate, async (req, res) => {
    await File.findByIdAndUpdate(req.body.fileId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ msg: "Moved" });
});

// --- SHARING (MANAGE ACCESS) ---
app.post('/api/files/share', authenticate, async (req, res) => {
    const { fileId, email, role, hours } = req.body;
    const expiry = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await File.findByIdAndUpdate(fileId, { 
        $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiry } } 
    });
    res.json({ msg: "OK" });
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
    try {
        const name = `${req.body.uploadId}-${req.body.fileName}`;
        const tPath = path.join('/tmp', name); // Standard for Render

        // 1. UPLOAD TO SUPABASE (Wait for this!)
        await minioClient.fPutObject(BUCKET_NAME, name, tPath);
        console.log("Uploaded to Supabase successfully");

        // 2. SAVE TO DATABASE
        const file = new File({ 
            fileName: req.body.fileName, 
            fileSize: fs.statSync(tPath).size, 
            path: name, 
            parentFolder: req.body.folderId || null, 
            owner: req.user.id, 
            isVault: req.body.isVault === 'true' 
        });
        await file.save(); 

        // 3. CLEAN UP TEMP FILE
        if (fs.existsSync(tPath)) fs.unlinkSync(tPath); 
        
        res.json(file);
    } catch (err) {
        console.error("SUPABASE UPLOAD ERROR:", err);
        res.status(500).json({ error: "Cloud storage failed" });
    }
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600) });
});

app.listen(process.env.PORT || 5000, () => console.log("Enterprise Backend Ready"));