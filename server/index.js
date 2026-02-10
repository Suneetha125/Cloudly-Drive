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
const SECRET = process.env.JWT_SECRET || "FINAL_DRIVE_PRO_2026";

// 1. Storage Setup
const minioClient = new Minio.Client({
    endPoint: (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0], 
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
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI);

// 3. SCHEMAS
const User = mongoose.model('User', { name: String, email: { type: String, unique: true }, password: String, vaultPIN: String, isVerified: { type: Boolean, default: false }, otp: String, otpExpires: Date });
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, expiresAt: Date }] });

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
    const token = authHeader.split(" ")[1];
    try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
};

// --- NUCLEAR RESET ---
app.get('/api/auth/nuclear-reset', async (req, res) => {
    await User.deleteMany({});
    await File.deleteMany({});
    await Folder.deleteMany({});
    res.send("Database Wiped Clean. You can now register again.");
});

// --- AI CHAT (FIXED PDF) ---
app.post('/api/ai/chat', authenticate, async (req, res) => {
    try {
        const file = await File.findById(req.body.fileId);
        const stream = await minioClient.getObject(BUCKET_NAME, file.path);
        let chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        let text = "";
        if (file.fileName.toLowerCase().endsWith('.pdf')) {
            const data = await pdf(buffer);
            text = data.text;
        } else { text = buffer.toString(); }
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Context: ${text.slice(0, 7000)}\n\nQuestion: ${req.body.question}`);
        res.json({ answer: result.response.text() });
    } catch (e) { res.status(500).json({ answer: "AI Error: Could not read file." }); }
});

// --- AUTH & VAULT ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), otp, otpExpires: Date.now() + 600000 });
        await user.save();
        await transporter.sendMail({ to: email, subject: "Cloudly Code", text: `Your code: ${otp}` });
        res.json({ msg: "OTP Sent" });
    } catch (e) { res.status(400).json({ error: "User exists" }); }
});

app.post('/api/auth/verify', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp });
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

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ unlocked: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).send("Wrong");
});

// --- DRIVE FEATURES ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const user = await User.findById(req.user.id);
        const shared = await File.find({ "sharedWith.email": user.email });
        return res.json({ folders: [], files: shared });
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const files = await File.find({ owner: req.user.id });
    res.json({ used: files.reduce((acc, f) => acc + f.fileSize, 0), limit: 32212254720 });
});

app.patch('/api/files/move', authenticate, async (req, res) => {
    await File.findByIdAndUpdate(req.body.fileId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ msg: "Moved" });
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

// --- SYSTEM ---
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

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));