// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const Minio = require('minio');
// const nodemailer = require('nodemailer');

// const app = express();
// const SECRET = process.env.JWT_SECRET || "REAL_DRIVE_PRO_2026";

// // 1. Supabase S3 Setup (Fixed Endpoint Logic)
// const s3Host = (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0];
// const minioClient = new Minio.Client({
//     endPoint: s3Host || '127.0.0.1', 
//     port: 443, useSSL: true,
//     accessKey: process.env.S3_ACCESS_KEY,
//     secretKey: process.env.S3_SECRET_KEY,
//     region: 'us-east-1', pathStyle: true
// });
// const BUCKET_NAME = 'cloudly';

// // 2. Email Setup
// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com', port: 465, secure: true,
//     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
//     family: 4 
// });

// app.use(cors());
// app.use(express.json());

// mongoose.connect(process.env.MONGO_URI);

// // 3. SCHEMAS
// const User = mongoose.model('User', { name: String, email: { type: String, unique: true }, password: String, vaultPIN: String, storageUsed: { type: Number, default: 0 } });
// const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
// const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, role: String, expiresAt: Date }] });

// const authenticate = (req, res, next) => {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).send("Denied");
//     const token = authHeader.split(" ")[1];
//     try { req.user = jwt.verify(token, SECRET); next(); } catch (err) { res.status(401).send("Invalid"); }
// };

// // --- ROUTES ---

// // Manage Access (Share with Role & Expiry)
// app.post('/api/files/share', authenticate, async (req, res) => {
//     const { fileId, email, role, hours } = req.body;
//     const expiryDate = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
//     await File.findByIdAndUpdate(fileId, { 
//         $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiryDate } } 
//     });
//     res.json({ msg: "Shared" });
// });

// // Create Folder
// app.post('/api/drive/folder', authenticate, async (req, res) => {
//     const folder = new Folder({ ...req.body, owner: req.user.id });
//     await folder.save(); res.json(folder);
// });

// // Contents (Handles Shared Tab)
// app.get('/api/drive/contents', authenticate, async (req, res) => {
//     const { folderId, tab } = req.query;
//     let filter = { owner: req.user.id };
//     if (tab === 'starred') filter.isStarred = true;
//     else if (tab === 'trash') filter.isTrash = true;
//     else if (tab === 'vault') filter.isVault = true;
//     else if (tab === 'shared') {
//         const shared = await File.find({ "sharedWith.email": req.user.email });
//         return res.json({ folders: [], files: shared.filter(f => {
//             const acc = f.sharedWith.find(a => a.email === req.user.email);
//             return !acc.expiresAt || new Date() < acc.expiresAt;
//         })});
//     } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
//     res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
// });

// // Parallel Upload Logic
// const upload = multer({ dest: '/tmp/' });
// app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
//     const tPath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
//     fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
//     fs.unlinkSync(req.file.path); res.json({ success: true });
// });
// app.post('/api/upload/complete', authenticate, async (req, res) => {
//     const name = `${req.body.uploadId}-${req.body.fileName}`;
//     const tPath = path.join('/tmp', name);
//     try {
//         await minioClient.fPutObject(BUCKET_NAME, name, tPath);
//         const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
//         await file.save(); 
//         await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: file.fileSize } });
//         fs.unlinkSync(tPath); res.json(file);
//     } catch (err) { res.status(500).send("Upload failed"); }
// });

// // Storage (30GB Limit)
// app.get('/api/drive/storage', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     res.json({ used: user.storageUsed, limit: 32212254720 });
// });

// // Account Deletion
// app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
//     const userId = req.user.id;
//     const files = await File.find({ owner: userId });
//     for (let f of files) { try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){} }
//     await File.deleteMany({ owner: userId }); await Folder.deleteMany({ owner: userId }); await User.findByIdAndDelete(userId);
//     res.json({ success: true });
// });

// app.listen(process.env.PORT || 5000, () => console.log("Server Running"));
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
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026";
const BUCKET_NAME = 'cloudly';

// 1. Supabase S3 Setup - Fixed for Global Deployment
const minioClient = new Minio.Client({
    endPoint: (process.env.S3_ENDPOINT || '').replace('https://', '').split('/')[0],
    port: 443,
    useSSL: true,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: 'us-east-1',
    pathStyle: true
});

// 2. Email Setup - Fixed IPv6 Error for Render
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    family: 4 
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB Cloud!"))
  .catch(err => console.log("Cloud Connection Error:", err));

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, isVerified: { type: Boolean, default: true }, // Verified by default, OTP for recovery
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
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: "Account exists" });
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10), isVerified: true });
        await user.save(); res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Signup failed" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ error: "Invalid credentials" });
    res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    await transporter.sendMail({ to: email, subject: "Cloudly Recovery", text: `Reset Code: ${otp}` });
    res.json({ msg: "OTP Sent" });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
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

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'shared') {
        const shared = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: shared.filter(f => {
            const acc = f.sharedWith.find(a => a.email === req.user.email);
            return !acc.expiresAt || new Date() < acc.expiresAt;
        })});
    }
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.post('/api/drive/folder', authenticate, async (req, res) => {
    const folder = new Folder({ ...req.body, owner: req.user.id });
    await folder.save(); res.json(folder);
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const Model = req.body.type === 'file' ? File : Folder;
    await Model.findByIdAndUpdate(req.body.itemId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ success: true });
});

app.post('/api/drive/share', authenticate, async (req, res) => {
    const { fileId, email, role, hours } = req.body;
    const expiry = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await File.findByIdAndUpdate(fileId, { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiry } } });
    res.json({ success: true });
});

app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
    if (req.params.type === 'file') {
        const f = await File.findOne({ _id: req.params.id, owner: req.user.id });
        if (f) { await minioClient.removeObject(BUCKET_NAME, f.path); await File.deleteOne({ _id: f._id }); }
    } else await Folder.deleteOne({ _id: req.params.id, owner: req.user.id });
    res.json({ success: true });
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
        const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === true });
        await file.save(); 
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(tPath).size } });
        fs.unlinkSync(tPath); res.json(file);
    } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const f = await File.findOne({ _id: req.params.id });
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: 32212254720 }); // 30GB
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ success: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ success: true });
    else res.status(403).json({error: "Wrong PIN"});
});

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));