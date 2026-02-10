// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const nodemailer = require('nodemailer');
// const { createClient } = require('@supabase/supabase-js');

// const app = express();
// const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_2026";
// const BUCKET_NAME = 'cloudly';

// const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);

// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com', port: 465, secure: true,
//     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
// });

// app.use(cors());
// app.use(express.json({ limit: '50mb' }));

// mongoose.connect(process.env.MONGO_URI).then(() => {
//     app.listen(process.env.PORT || 5000, () => console.log("Server Running on 5000"));
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
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
//     sharedWith: [{ email: String, role: String, expiresAt: Date }]
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

// // --- ROUTES ---

// app.get('/api/drive/contents', authenticate, async (req, res) => {
//     const { folderId, tab, search, vaultUnlocked } = req.query;
//     let query = { owner: req.user.id };

//     if (tab === 'shared') {
//         query = { "sharedWith.email": req.user.email };
//     } else if (tab === 'starred') {
//         query.isStarred = true;
//     } else if (tab === 'vault') {
//         if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Vault Locked" });
//         query.isVault = true;
//     } else {
//         query.isVault = false;
//         query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
//     }

//     if (search) {
//         const regex = { $regex: search, $options: 'i' };
//         const folders = await Folder.find({ ...query, name: regex });
//         const files = await File.find({ ...query, fileName: regex });
//         return res.json({ folders, files });
//     }

//     const folders = await Folder.find(query);
//     const files = await File.find(query);
//     res.json({ folders, files });
// });

// app.patch('/api/drive/move', authenticate, async (req, res) => {
//     const { type, itemId, targetId } = req.body;
//     const Model = type === 'file' ? File : Folder;
//     let update = {};

//     if (targetId === 'vault') update = { isVault: true, isStarred: false, parentFolder: null };
//     else if (targetId === 'starred') update = { isStarred: true };
//     else if (targetId === 'root') update = { isVault: false, parentFolder: null };
//     else update = { parentFolder: targetId, isVault: false };

//     await Model.updateOne({ _id: itemId, owner: req.user.id }, update);
//     res.json({ success: true });
// });

// app.post('/api/files/share', authenticate, async (req, res) => {
//     const { fileId, type, email, role, hours } = req.body;
//     const Model = type === 'file' ? File : Folder;
//     const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
//     await Model.updateOne({ _id: fileId, owner: req.user.id }, { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt } } });
//     res.json({ success: true });
// });

// app.post('/api/vault/unlock', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     if (!user.vaultPIN) {
//         user.vaultPIN = await bcrypt.hash(req.body.pin, 10);
//         await user.save();
//         return res.json({ setup: true });
//     }
//     if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ success: true });
//     else res.status(403).json({ error: "Wrong PIN" });
// });

// // UPLOAD
// const upload = multer({ dest: '/tmp/' });
// app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
//     const temp = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
//     fs.appendFileSync(temp, fs.readFileSync(req.file.path));
//     fs.unlinkSync(req.file.path);
//     res.sendStatus(200);
// });
// app.post('/api/upload/complete', authenticate, async (req, res) => {
//     const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
//     const temp = path.join('/tmp', `${uploadId}-${fileName}`);
//     const stats = fs.statSync(temp);
//     const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
//     await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
//     const file = new File({ fileName, fileSize: stats.size, s3Path, mimeType, parentFolder: (folderId === "null" || !folderId) ? null : folderId, owner: req.user.id, isVault });
//     await file.save();
//     await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: stats.size } });
//     fs.unlinkSync(temp);
//     res.json(file);
// });

// // DOWNLOAD & PREVIEW (Synchronized Path)
// app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
//     const file = await File.findById(req.params.id);
//     if(!file) return res.status(404).json({error: "File not found"});
//     const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600, {
//         download: req.query.download === 'true' ? file.fileName : false
//     });
//     res.json({ url: data.signedUrl });
// });

// app.post('/api/folders', authenticate, async (req, res) => {
//     const folder = new Folder({ ...req.body, owner: req.user.id });
//     await folder.save();
//     res.json(folder);
// });

// // DELETE (Synchronized Path)
// app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
//     try {
//         if (req.params.type === 'file') {
//             const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
//             if (file) {
//                 await supabase.storage.from(BUCKET_NAME).remove([file.s3Path]);
//                 await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } });
//                 await File.deleteOne({ _id: req.params.id });
//             }
//         } else {
//             await Folder.deleteOne({ _id: req.params.id, owner: req.user.id });
//         }
//         res.json({ success: true });
//     } catch (e) { res.status(500).json({ error: "Delete failed" }); }
// });

// app.get('/api/drive/storage', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     res.json({ used: user.storageUsed, limit: user.storageLimit });
// });

// // AUTH
// app.post('/api/auth/register', async (req, res) => {
//     const hash = await bcrypt.hash(req.body.password, 10);
//     const user = new User({ ...req.body, password: hash });
//     await user.save();
//     res.json({ success: true });
// });
// app.post('/api/auth/login', async (req, res) => {
//     const user = await User.findOne({ email: req.body.email });
//     if (user && await bcrypt.compare(req.body.password, user.password)) {
//         const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
//         res.json({ token, userName: user.name, userId: user._id });
//     } else res.status(401).json({ error: "Invalid credentials" });
// });
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_2026";
const BUCKET_NAME = 'cloudly';

const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI).then(() => {
    app.listen(process.env.PORT || 5000, () => console.log("Backend Live"));
});

// --- MODELS ---
const User = mongoose.model('User', {
    name: String, email: { type: String, unique: true }, password: { type: String },
    vaultPIN: String, otp: String, otpExpires: Date,
    storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 } 
});

const Folder = mongoose.model('Folder', {
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

const File = mongoose.model('File', {
    fileName: String, fileSize: Number, s3Path: String, mimeType: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
};

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab, search, vaultUnlocked } = req.query;
    let query = { owner: req.user.id };

    if (tab === 'shared') {
        query = { "sharedWith.email": req.user.email };
    } else if (tab === 'starred') {
        query.isStarred = true;
    } else if (tab === 'vault') {
        if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Vault Locked" });
        query.isVault = true;
    } else {
        query.isVault = false;
        query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
    }

    if (search) {
        const regex = { $regex: search, $options: 'i' };
        const folders = await Folder.find({ ...query, name: regex });
        const files = await File.find({ ...query, fileName: regex });
        return res.json({ folders, files });
    }

    const folders = await Folder.find(query);
    const files = await File.find(query);
    res.json({ folders, files });
});

// STAR LOGIC
app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
    const Model = req.params.type === 'file' ? File : Folder;
    await Model.updateOne({ _id: req.params.id, owner: req.user.id }, { isStarred: req.body.isStarred });
    res.json({ success: true });
});

// ADVANCED SHARE LOGIC
app.post('/api/files/share', authenticate, async (req, res) => {
    const { fileId, type, email, role, hours } = req.body;
    const Model = type === 'file' ? File : Folder;
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await Model.updateOne(
        { _id: fileId, owner: req.user.id },
        { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt } } }
    );
    res.json({ success: true });
});

// DELETE ACCOUNT (Full Wipe)
app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    const files = await File.find({ owner: userId });
    for (let f of files) { await supabase.storage.from(BUCKET_NAME).remove([f.s3Path]); }
    await File.deleteMany({ owner: userId });
    await Folder.deleteMany({ owner: userId });
    await User.findByIdAndDelete(userId);
    res.json({ success: true });
});

// PREVIEW & DOWNLOAD
app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600, {
        download: req.query.download === 'true' ? file.fileName : false
    });
    res.json({ url: data.signedUrl });
});

// DELETE ITEM
app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
    const Model = req.params.type === 'file' ? File : Folder;
    if (req.params.type === 'file') {
        const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
        if (file) {
            await supabase.storage.from(BUCKET_NAME).remove([file.s3Path]);
            await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } });
        }
    }
    await Model.deleteOne({ _id: req.params.id, owner: req.user.id });
    res.json({ success: true });
});

// OTHER ROUTES (Move, Vault, Upload, Auth) - Same logic as before
app.patch('/api/drive/move', authenticate, async (req, res) => {
    const { type, itemId, targetId } = req.body;
    const Model = type === 'file' ? File : Folder;
    let upd = targetId === 'root' ? { parentFolder: null, isVault: false } : { parentFolder: targetId, isVault: false };
    if (targetId === 'vault') upd = { isVault: true, parentFolder: null };
    await Model.updateOne({ _id: itemId, owner: req.user.id }, upd);
    res.json({ success: true });
});

const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path);
    res.sendStatus(200);
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
    const temp = path.join('/tmp', `${uploadId}-${fileName}`);
    const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
    await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
    const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: folderId === "null" ? null : folderId, owner: req.user.id, isVault });
    await file.save();
    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
    fs.unlinkSync(temp);
    res.json(file);
});

app.post('/api/folders', authenticate, async (req, res) => {
    const f = new Folder({ ...req.body, owner: req.user.id });
    await f.save();
    res.json(f);
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    res.json({ used: u.storageUsed, limit: u.storageLimit });
});

app.post('/api/auth/register', async (req, res) => {
    const h = await bcrypt.hash(req.body.password, 10);
    await new User({ ...req.body, password: h }).save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email });
    if (u && await bcrypt.compare(req.body.password, u.password)) {
        res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
    } else res.status(401).json({ error: "Invalid" });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    if (!u.vaultPIN) { u.vaultPIN = await bcrypt.hash(req.body.pin, 10); await u.save(); return res.json({ setup: true }); }
    if (await bcrypt.compare(req.body.pin, u.vaultPIN)) res.json({ success: true });
    else res.status(403).json({ error: "Fail" });
});