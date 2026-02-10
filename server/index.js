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
const SECRET = process.env.JWT_SECRET || "FINAL_DRIVE_PRO_2026";

// 1. Supabase S3 Setup
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '', 
    port: 443, useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    region: 'us-east-1', pathStyle: true
});
const BUCKET_NAME = 'cloudly';

// 2. Email Setup (Requires App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
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

// --- NUCLEAR RESET (CLEARS DATABASE) ---
app.get('/api/auth/nuclear-reset', async (req, res) => {
    await User.deleteMany({});
    await File.deleteMany({});
    await Folder.deleteMany({});
    res.send("Database Wiped Clean. You can now register again.");
});

// --- AUTH & OTP ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        
        // This sends the REAL email
        await transporter.sendMail({ 
            from: `"Cloudly Support" <${process.env.EMAIL_USER}>`,
            to: email, 
            subject: "Cloudly Verification Code", 
            text: `Your verification code is: ${otp}. It expires in 10 minutes.` 
        });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "User already exists" }); }
});

app.post('/api/auth/verify', async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), otp: otp });
    
    if (!user) return res.status(400).json({ error: "Invalid OTP code" });
    
    user.isVerified = true; 
    user.otp = undefined; 
    await user.save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Unverified" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
    res.json({ token, userName: user.name });
});

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

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
    await minioClient.fPutObject(BUCKET_NAME, name, tPath);
    const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
    await file.save(); fs.unlinkSync(tPath); res.json(file);
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600) });
});

app.listen(process.env.PORT || 5000, () => console.log("Backend Ready"));