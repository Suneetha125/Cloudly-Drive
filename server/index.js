// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const { Resend } = require('resend'); // Use Resend for reliable emails
// const { createClient } = require('@supabase/supabase-js');

// const app = express();
// const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_2026";
// const BUCKET_NAME = 'cloudly';

// // 1. Initialize Clients
// const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);
// const resend = new Resend(process.env.RESEND_API_KEY);

// app.use(cors());
// app.use(express.json({ limit: '50mb' }));

// mongoose.connect(process.env.MONGO_URI).then(() => {
//     console.log("Connected to MongoDB Cloud!");
// });

// // --- MODELS ---
// const User = mongoose.model('User', {
//     name: String, email: { type: String, unique: true }, password: { type: String },
//     vaultPIN: String, otp: String, otpExpires: Date,
//     storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 } 
// });

// const Folder = mongoose.model('Folder', {
//     name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }
// });

// const File = mongoose.model('File', {
//     fileName: String, fileSize: Number, s3Path: String, mimeType: String,
//     parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
//     sharedWith: [{ email: String, role: String, expiresAt: Date }]
// });

// const authenticate = (req, res, next) => {
//     try {
//         const token = req.headers.authorization.split(" ")[1];
//         req.user = jwt.verify(token, SECRET);
//         next();
//     } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
// };

// // --- AUTH & RECOVERY ---

// // Register (No OTP needed here as per your request)
// app.post('/api/auth/register', async (req, res) => {
//     try {
//         const h = await bcrypt.hash(req.body.password, 10);
//         await new User({ ...req.body, password: h }).save();
//         res.json({ success: true });
//     } catch (e) { res.status(400).json({ error: "Email already exists" }); }
// });

// app.post('/api/auth/login', async (req, res) => {
//     const u = await User.findOne({ email: req.body.email.toLowerCase() });
//     if (u && await bcrypt.compare(req.body.password, u.password)) {
//         res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
//     } else res.status(401).json({ error: "Invalid credentials" });
// });

// // FORGOT PASSWORD (Sends OTP via Resend)
// app.post('/api/auth/forgot-password', async (req, res) => {
//     try {
//         const { email } = req.body;
//         const user = await User.findOne({ email: email.toLowerCase() });
//         if (!user) return res.status(404).json({ error: "User not found" });

//         const otp = Math.floor(100000 + Math.random() * 900000).toString();
//         user.otp = otp;
//         user.otpExpires = Date.now() + 600000; // 10 mins
//         await user.save();

//         await resend.emails.send({
//             from: 'Cloudly <onboarding@resend.dev>',
//             to: user.email,
//             subject: 'Password Recovery Code',
//             html: `<p>Your reset code is: <strong>${otp}</strong></p>`
//         });
//         res.json({ success: true });
//     } catch (e) { res.status(500).json({ error: "Failed to send email" }); }
// });

// app.post('/api/auth/reset-password', async (req, res) => {
//     const { email, otp, newPassword } = req.body;
//     const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
//     if (!user) return res.status(400).json({ error: "Invalid or expired OTP" });
//     user.password = await bcrypt.hash(newPassword, 10);
//     user.otp = undefined; await user.save();
//     res.json({ success: true });
// });

// // --- DRIVE LOGIC ---

// app.get('/api/drive/contents', authenticate, async (req, res) => {
//     const { folderId, tab, vaultUnlocked } = req.query;
//     let query = { owner: req.user.id };
//     if (tab === 'starred') query.isStarred = true;
//     else if (tab === 'vault') {
//         if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Vault Locked" });
//         query.isVault = true;
//     } else {
//         query.isVault = false;
//         query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
//     }
//     res.json({ folders: await Folder.find(query), files: await File.find(query) });
// });

// app.post('/api/vault/unlock', authenticate, async (req, res) => {
//     const u = await User.findById(req.user.id);
//     if (!u.vaultPIN) { 
//         u.vaultPIN = await bcrypt.hash(req.body.pin, 10); 
//         await u.save(); 
//         return res.json({ setup: true }); 
//     }
//     if (await bcrypt.compare(req.body.pin, u.vaultPIN)) res.json({ success: true });
//     else res.status(403).json({ error: "Fail" });
// });

// // --- UPLOAD LOGIC ---
// const upload = multer({ dest: '/tmp/' });
// app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
//     fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
//     fs.unlinkSync(req.file.path);
//     res.sendStatus(200);
// });
// app.post('/api/upload/complete', authenticate, async (req, res) => {
//     try {
//         const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
//         const temp = path.join('/tmp', `${uploadId}-${fileName}`);
//         const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
//         await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
//         const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: folderId === "null" ? null : folderId, owner: req.user.id, isVault: isVault === 'true' || isVault === true });
//         await file.save();
//         await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
//         fs.unlinkSync(temp);
//         res.json(file);
//     } catch (e) { res.status(500).json({ error: "Upload failed" }); }
// });

// app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
//     const file = await File.findById(req.params.id);
//     const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600);
//     res.json({ url: data.signedUrl });
// });

// app.get('/api/drive/storage', authenticate, async (req, res) => {
//     const u = await User.findById(req.user.id);
//     res.json({ used: u.storageUsed, limit: u.storageLimit });
// });

// app.get('/', (req, res) => res.send("Cloudly API Live"));

// app.listen(process.env.PORT || 5000);
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
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, 
    vaultPIN: String, isVerified: { type: Boolean, default: true }, // Auto-verify for now to avoid SMTP issues
    otp: String, otpExpires: Date, storageUsed: { type: Number, default: 0 }
});
const Folder = mongoose.model('Folder', { name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false } });
const File = mongoose.model('File', { fileName: String, fileSize: Number, path: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }, sharedWith: [{ email: String, expiresAt: Date }] });

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
        const user = new User({ ...req.body, email, password: await bcrypt.hash(req.body.password, 10) });
        await user.save(); res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Account exists" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
    } else res.status(400).json({ error: "Invalid credentials" });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000;
    await user.save();
    // Use Brevo API to send OTP
    await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ sender: { name: "Cloudly", email: process.env.EMAIL_USER }, to: [{ email: user.email }], subject: "Reset Code", textContent: `Code: ${otp}` })
    });
    res.json({ msg: "Sent" });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp });
    if (!user) return res.status(400).json({ error: "Invalid OTP" });
    user.password = await bcrypt.hash(req.body.newPassword, 10);
    user.otp = undefined; await user.save();
    res.json({ success: true });
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
    if (tab === 'starred') filter.isStarred = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'trash') filter.isTrash = true;
    else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = (folderId === "null" || !folderId) ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: 32212254720 }); // 30GB
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    const Model = req.body.type === 'file' ? File : Folder;
    await Model.findByIdAndUpdate(req.body.itemId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId, isVault: req.body.targetId === 'vault' });
    res.json({ success: true });
});

// Upload
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

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ setup: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ success: true });
    else res.status(403).json({error: "Fail"});
});

app.get('/api/auth/nuclear-reset', async (req, res) => {
    await User.deleteMany({}); await File.deleteMany({}); await Folder.deleteMany({});
    res.send("Database Wiped");
});

app.get('/', (req, res) => res.send("Cloudly API Live"));
app.listen(process.env.PORT || 5000);