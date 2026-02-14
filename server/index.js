// // require('dotenv').config();
// // const express = require('express');
// // const mongoose = require('mongoose');
// // const cors = require('cors');
// // const multer = require('multer');
// // const path = require('path');
// // const fs = require('fs');
// // const jwt = require('jsonwebtoken');
// // const bcrypt = require('bcryptjs');
// // const nodemailer = require('nodemailer');
// // const { createClient } = require('@supabase/supabase-js');

// // const app = express();
// // const SECRET = process.env.JWT_SECRET || "CLOUDLY_PRO_2026";
// // const BUCKET_NAME = 'cloudly';

// // // Clients
// // const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);
// // const transporter = nodemailer.createTransport({
// //     host: 'smtp-relay.brevo.com', port: 587,
// //     auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_PASS }
// // });

// // app.use(cors());
// // app.use(express.json({ limit: '50mb' }));

// // mongoose.connect(process.env.MONGO_URI);

// // // Models
// // const User = mongoose.model('User', {
// //     name: String, email: { type: String, unique: true }, password: { type: String },
// //     vaultPIN: String, otp: String, otpExpires: Date,
// //     storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 }
// // });

// // const Folder = mongoose.model('Folder', {
// //     name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
// //     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
// //     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }
// // });

// // const File = mongoose.model('File', {
// //     fileName: String, fileSize: Number, s3Path: String, mimeType: String,
// //     parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
// //     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
// //     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
// //     sharedWith: [{ email: String, role: String, expiresAt: Date }]
// // });

// // const authenticate = (req, res, next) => {
// //     try {
// //         const token = req.headers.authorization.split(" ")[1];
// //         req.user = jwt.verify(token, SECRET);
// //         next();
// //     } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
// // };

// // // --- AUTH & RECOVERY ---
// // app.post('/api/auth/register', async (req, res) => {
// //     const hash = await bcrypt.hash(req.body.password, 10);
// //     await new User({ ...req.body, email: req.body.email.toLowerCase(), password: hash }).save();
// //     res.json({ success: true });
// // });

// // app.post('/api/auth/login', async (req, res) => {
// //     const u = await User.findOne({ email: req.body.email.toLowerCase() });
// //     if (u && await bcrypt.compare(req.body.password, u.password)) {
// //         res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
// //     } else res.status(401).json({ error: "Invalid login" });
// // });

// // app.post('/api/auth/forgot-password', async (req, res) => {
// //     const user = await User.findOne({ email: req.body.email.toLowerCase() });
// //     if (!user) return res.status(404).json({ error: "User not found" });
// //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
// //     user.otp = otp; user.otpExpires = Date.now() + 600000;
// //     await user.save();
// //     await transporter.sendMail({ from: process.env.BREVO_USER, to: user.email, subject: 'Cloudly Code', text: `Code: ${otp}` });
// //     res.json({ success: true });
// // });

// // app.post('/api/auth/reset-password', async (req, res) => {
// //     const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
// //     if (!user) return res.status(400).json({ error: "Invalid/Expired OTP" });
// //     user.password = await bcrypt.hash(req.body.newPassword, 10);
// //     user.otp = undefined; await user.save();
// //     res.json({ success: true });
// // });

// // // --- DRIVE LOGIC ---
// // app.get('/api/drive/contents', authenticate, async (req, res) => {
// //     const { folderId, tab, vaultUnlocked, search } = req.query;
// //     let query = { owner: req.user.id, isTrash: tab === 'trash' };

// //     if (tab === 'shared') query = { "sharedWith.email": req.user.email };
// //     else if (tab === 'starred') query.isStarred = true;
// //     else if (tab === 'vault') {
// //         if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Locked" });
// //         query.isVault = true;
// //     } else {
// //         query.isVault = false; query.isTrash = false;
// //         query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
// //     }

// //     if(search) {
// //         const regex = { $regex: search, $options: 'i' };
// //         return res.json({ folders: await Folder.find({...query, name: regex}), files: await File.find({...query, fileName: regex}) });
// //     }
// //     res.json({ folders: await Folder.find(query), files: await File.find(query) });
// // });

// // app.patch('/api/drive/action', authenticate, async (req, res) => {
// //     const { type, id, action, value } = req.body;
// //     const Model = type === 'file' ? File : Folder;
// //     let update = {};
// //     if (action === 'star') update.isStarred = value;
// //     if (action === 'move') {
// //         if (value === 'trash') update.isTrash = true;
// //         else if (value === 'vault') { update.isVault = true; update.parentFolder = null; }
// //         else { update.parentFolder = value === 'root' ? null : value; update.isTrash = false; update.isVault = false; }
// //     }
// //     await Model.updateOne({ _id: id, owner: req.user.id }, update);
// //     res.json({ success: true });
// // });

// // app.post('/api/files/share', authenticate, async (req, res) => {
// //     const { id, type, email, role, hours } = req.body;
// //     const Model = type === 'file' ? File : Folder;
// //     const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
// //     await Model.updateOne({ _id: id, owner: req.user.id }, { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt } } });
// //     res.json({ success: true });
// // });

// // // --- VAULT ---
// // app.post('/api/vault/unlock', authenticate, async (req, res) => {
// //     const u = await User.findById(req.user.id);
// //     if (!u.vaultPIN) { u.vaultPIN = await bcrypt.hash(req.body.pin, 10); await u.save(); return res.json({ setup: true }); }
// //     if (await bcrypt.compare(req.body.pin, u.vaultPIN)) res.json({ success: true });
// //     else res.status(403).json({ error: "Fail" });
// // });

// // app.post('/api/vault/reset-request', authenticate, async (req, res) => {
// //     const u = await User.findById(req.user.id);
// //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
// //     u.otp = otp; u.otpExpires = Date.now() + 600000; await u.save();
// //     await transporter.sendMail({ from: process.env.BREVO_USER, to: u.email, subject: 'Vault Reset', text: `OTP: ${otp}` });
// //     res.json({ success: true });
// // });

// // app.post('/api/vault/reset-confirm', authenticate, async (req, res) => {
// //     const u = await User.findOne({ _id: req.user.id, otp: req.body.otp, otpExpires: { $gt: Date.now() } });
// //     if (!u) return res.status(400).json({ error: "Invalid OTP" });
// //     u.vaultPIN = await bcrypt.hash(req.body.newPin, 10); u.otp = undefined; await u.save();
// //     res.json({ success: true });
// // });

// // // --- UPLOAD ---
// // const upload = multer({ dest: '/tmp/' });
// // app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// // app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
// //     fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
// //     fs.unlinkSync(req.file.path); res.sendStatus(200);
// // });
// // app.post('/api/upload/complete', authenticate, async (req, res) => {
// //     const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
// //     const temp = path.join('/tmp', `${uploadId}-${fileName}`);
// //     const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
// //     const { error } = await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
// //     if (error) return res.status(500).json({ error: error.message });
// //     const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: folderId === "null" ? null : folderId, owner: req.user.id, isVault: isVault === 'true' || isVault === true });
// //     await file.save();
// //     await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
// //     fs.unlinkSync(temp); res.json(file);
// // });

// // app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
// //     const file = await File.findById(req.params.id);
// //     const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600);
// //     res.json({ url: data.signedUrl });
// // });

// // app.get('/api/drive/storage', authenticate, async (req, res) => {
// //     const u = await User.findById(req.user.id);
// //     res.json({ used: u.storageUsed, limit: u.storageLimit });
// // });

// // app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
// //     const userId = req.user.id;
// //     const files = await File.find({ owner: userId });
// //     for (let f of files) await supabase.storage.from(BUCKET_NAME).remove([f.s3Path]);
// //     await File.deleteMany({ owner: userId }); await Folder.deleteMany({ owner: userId });
// //     await User.findByIdAndDelete(userId); res.json({ success: true });
// // });

// // app.listen(process.env.PORT || 10000);
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
// const SECRET = process.env.JWT_SECRET || "CLOUDLY_PRO_2026";
// const BUCKET_NAME = 'cloudly';

// const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);
// const transporter = nodemailer.createTransport({
//     host: 'smtp-relay.brevo.com', port: 587,
//     auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_PASS }
// });

// app.use(cors());
// app.use(express.json({ limit: '50mb' }));

// mongoose.connect(process.env.MONGO_URI);

// // --- MODELS ---
// const User = mongoose.model('User', {
//     name: String, email: { type: String, unique: true }, password: { type: String },
//     vaultPIN: String, otp: String, otpExpires: Date,
//     storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 }
// });

// const Folder = mongoose.model('Folder', {
//     name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
//     sharedWith: [{ email: String, role: String }]
// });

// const File = mongoose.model('File', {
//     fileName: String, fileSize: Number, s3Path: String, mimeType: String,
//     parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
//     sharedWith: [{ email: String, role: String }]
// });

// const authenticate = (req, res, next) => {
//     try {
//         const token = req.headers.authorization.split(" ")[1];
//         req.user = jwt.verify(token, SECRET);
//         next();
//     } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
// };

// // --- AUTH & OTP FLOW ---
// app.post('/api/auth/register', async (req, res) => {
//     const hash = await bcrypt.hash(req.body.password, 10);
//     await new User({ ...req.body, email: req.body.email.toLowerCase(), password: hash }).save();
//     res.json({ success: true });
// });

// app.post('/api/auth/login', async (req, res) => {
//     const u = await User.findOne({ email: req.body.email.toLowerCase() });
//     if (u && await bcrypt.compare(req.body.password, u.password)) {
//         res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
//     } else res.status(401).json({ error: "Invalid Login" });
// });

// app.post('/api/auth/forgot-password', async (req, res) => {
//     const user = await User.findOne({ email: req.body.email.toLowerCase() });
//     if (!user) return res.status(404).json({ error: "User not found" });
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     user.otp = otp; user.otpExpires = Date.now() + 600000; await user.save();
//     await transporter.sendMail({ from: process.env.BREVO_USER, to: user.email, subject: 'Cloudly Code', text: `Your Reset Code: ${otp}` });
//     res.json({ success: true });
// });

// app.post('/api/auth/reset-password', async (req, res) => {
//     const { email, otp, newPassword } = req.body;
//     const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
//     if (!user) return res.status(400).json({ error: "Invalid/Expired OTP" });
//     user.password = await bcrypt.hash(newPassword, 10);
//     user.otp = undefined; await user.save();
//     res.json({ success: true });
// });

// // --- DRIVE OPERATIONS ---
// app.get('/api/drive/contents', authenticate, async (req, res) => {
//     const { folderId, tab, vaultUnlocked } = req.query;
//     let query = { owner: req.user.id };

//     if (tab === 'shared') {
//         const files = await File.find({ "sharedWith.email": req.user.email });
//         const folders = await Folder.find({ "sharedWith.email": req.user.email });
//         return res.json({ files, folders });
//     }
    
//     if (tab === 'starred') query.isStarred = true;
//     else if (tab === 'trash') query.isTrash = true;
//     else if (tab === 'vault') {
//         if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Locked" });
//         query.isVault = true;
//     } else {
//         query.isVault = false; query.isTrash = false;
//         query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
//     }
//     res.json({ folders: await Folder.find(query), files: await File.find(query) });
// });

// app.post('/api/drive/folders', authenticate, async (req, res) => {
//     const { name, parentFolder, isVault } = req.body;
//     const folder = new Folder({ name, parentFolder: (parentFolder === "null" || !parentFolder) ? null : parentFolder, isVault, owner: req.user.id });
//     await folder.save();
//     res.json(folder);
// });

// app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
//     const Model = req.params.type === 'file' ? File : Folder;
//     const item = await Model.findOne({ _id: req.params.id, owner: req.user.id });
//     if (req.params.type === 'file' && item) {
//         await supabase.storage.from(BUCKET_NAME).remove([item.s3Path]);
//         await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -item.fileSize } });
//     }
//     await Model.deleteOne({ _id: req.params.id, owner: req.user.id });
//     res.json({ success: true });
// });

// // --- VAULT PIN MANAGEMENT ---
// app.post('/api/vault/unlock', authenticate, async (req, res) => {
//     const u = await User.findById(req.user.id);
//     if (!u.vaultPIN) { 
//         u.vaultPIN = await bcrypt.hash(req.body.pin, 10); 
//         await u.save(); 
//         return res.json({ setup: true }); 
//     }
//     const match = await bcrypt.compare(req.body.pin, u.vaultPIN);
//     if (match) res.json({ success: true });
//     else res.status(403).json({ error: "Incorrect PIN" });
// });

// // --- UPLOAD ---
// const upload = multer({ dest: '/tmp/' });
// app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
//     fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
//     fs.unlinkSync(req.file.path); res.sendStatus(200);
// });
// app.post('/api/upload/complete', authenticate, async (req, res) => {
//     const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
//     const temp = path.join('/tmp', `${uploadId}-${fileName}`);
//     const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
//     await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
//     const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: (folderId === "null" || !folderId) ? null : folderId, owner: req.user.id, isVault });
//     await file.save();
//     await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
//     fs.unlinkSync(temp); res.json(file);
// });

// app.listen(process.env.PORT || 10000);
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
const SECRET = process.env.JWT_SECRET || "CLOUDLY_PRO_2026";
const BUCKET_NAME = 'cloudly';

const supabase = createClient(process.env.SUPABASE_URL, process.env.S3_SECRET_KEY);
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', port: 587,
    auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_PASS }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI);

// --- MODELS ---
const User = mongoose.model('User', {
    name: String, email: { type: String, unique: true }, password: { type: String },
    vaultPIN: String, otp: String, otpExpires: Date,
    storageUsed: { type: Number, default: 0 }, storageLimit: { type: Number, default: 32212254720 }
});

const Folder = mongoose.model('Folder', {
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

const File = mongoose.model('File', {
    fileName: String, fileSize: Number, s3Path: String, mimeType: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});

const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { res.status(401).json({ error: "Unauthorized" }); }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);
    await new User({ ...req.body, email: req.body.email.toLowerCase(), password: hash }).save();
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email.toLowerCase() });
    if (u && await bcrypt.compare(req.body.password, u.password)) {
        res.json({ token: jwt.sign({ id: u._id, email: u.email }, SECRET), userName: u.name });
    } else res.status(401).json({ error: "Invalid Login" });
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 600000; await user.save();
    await transporter.sendMail({ from: process.env.BREVO_USER, to: user.email, subject: 'Cloudly Code', text: `OTP: ${otp}` });
    res.json({ success: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), otp: req.body.otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid/Expired OTP" });
    user.password = await bcrypt.hash(req.body.newPassword, 10);
    user.otp = undefined; await user.save();
    res.json({ success: true });
});

// --- DRIVE OPERATIONS ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab, vaultUnlocked, search } = req.query;
    let query = { owner: req.user.id };

    if (tab === 'shared') {
        const shared = { "sharedWith.email": req.user.email };
        return res.json({ folders: await Folder.find(shared), files: await File.find(shared) });
    }

    if (tab === 'starred') query.isStarred = true;
    else if (tab === 'trash') query.isTrash = true;
    else if (tab === 'vault') {
        if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Locked" });
        query.isVault = true;
    } else {
        query.isVault = false; query.isTrash = false;
        query.parentFolder = (folderId === "null" || !folderId) ? null : folderId;
    }

    if(search) {
        const regex = { $regex: search, $options: 'i' };
        return res.json({ folders: await Folder.find({...query, name: regex}), files: await File.find({...query, fileName: regex}) });
    }
    res.json({ folders: await Folder.find(query), files: await File.find(query) });
});

app.post('/api/drive/folders', authenticate, async (req, res) => {
    const f = new Folder({ name: req.body.name, parentFolder: req.body.parentFolder === "null" ? null : req.body.parentFolder, isVault: req.body.isVault, owner: req.user.id });
    await f.save(); res.json(f);
});

app.patch('/api/drive/action', authenticate, async (req, res) => {
    const { type, id, action, value } = req.body;
    const Model = type === 'file' ? File : Folder;
    let update = {};
    if (action === 'star') update.isStarred = value;
    if (action === 'move') {
        if (value === 'trash') update.isTrash = true;
        else if (value === 'vault') { update.isVault = true; update.parentFolder = null; update.isTrash = false; }
        else { update.parentFolder = value === 'root' ? null : value; update.isTrash = false; update.isVault = false; }
    }
    await Model.updateOne({ _id: id, owner: req.user.id }, update);
    res.json({ success: true });
});

app.post('/api/files/share', authenticate, async (req, res) => {
    const { id, type, email, role, hours } = req.body;
    const Model = type === 'file' ? File : Folder;
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await Model.updateOne({ _id: id, owner: req.user.id }, { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt } } });
    res.json({ success: true });
});

app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
    const Model = req.params.type === 'file' ? File : Folder;
    const item = await Model.findOne({ _id: req.params.id, owner: req.user.id });
    if (req.params.type === 'file' && item) {
        await supabase.storage.from(BUCKET_NAME).remove([item.s3Path]);
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -item.fileSize } });
    }
    await Model.deleteOne({ _id: req.params.id });
    res.json({ success: true });
});

// --- VAULT PIN ---
app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    if (!u.vaultPIN) { u.vaultPIN = await bcrypt.hash(req.body.pin, 10); await u.save(); return res.json({ setup: true }); }
    if (await bcrypt.compare(req.body.pin, u.vaultPIN)) res.json({ success: true });
    else res.status(403).json({ error: "Incorrect PIN" });
});

app.post('/api/vault/reset-request', authenticate, async (req, res) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await User.findByIdAndUpdate(req.user.id, { otp, otpExpires: Date.now() + 600000 });
    await transporter.sendMail({ from: process.env.BREVO_USER, to: req.user.email, subject: 'Vault Reset', text: `Code: ${otp}` });
    res.json({ success: true });
});

// --- UPLOAD ---
const upload = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    fs.appendFileSync(path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`), fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.sendStatus(200);
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
    const temp = path.join('/tmp', `${uploadId}-${fileName}`);
    const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
    await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(temp), { contentType: mimeType });
    const file = new File({ fileName, fileSize: fs.statSync(temp).size, s3Path, mimeType, parentFolder: folderId === "null" ? null : folderId, owner: req.user.id, isVault });
    await file.save();
    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(temp).size } });
    fs.unlinkSync(temp); res.json(file);
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600);
    res.json({ url: data.signedUrl });
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const u = await User.findById(req.user.id);
    res.json({ used: u.storageUsed, limit: u.storageLimit });
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    await User.findByIdAndDelete(req.user.id);
    res.json({ success: true });
});

app.listen(process.env.PORT || 10000);