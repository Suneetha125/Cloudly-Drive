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
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026"; 
const BUCKET_NAME = 'cloudly'; 

// --- Supabase Client Setup ---
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.S3_SECRET_KEY, 
    {
        auth: {
            persistSession: false, 
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    }
);

// Email Setup
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
  .then(() => {
      console.log("Connected to MongoDB Cloud!");
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
  })
  .catch(err => {
      console.error("CRITICAL STARTUP ERROR:", err.message);
      process.exit(1);
  });

// --- SCHEMAS ---
const User = mongoose.model('User', {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    vaultPIN: String,
    isVerified: { type: Boolean, default: true },
    otp: String,
    otpExpires: Date,
    storageUsed: { type: Number, default: 0 },
    storageLimit: { type: Number, default: 32212254720 } 
});

const Folder = mongoose.model('Folder', {
    name: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isStarred: { type: Boolean, default: false },
    isVault: { type: Boolean, default: false },
    isTrash: { type: Boolean, default: false }
});

const File = mongoose.model('File', {
    fileName: String,
    fileSize: Number,
    s3Path: String, 
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isStarred: { type: Boolean, default: false },
    isVault: { type: Boolean, default: false },
    isTrash: { type: Boolean, default: false },
    sharedWith: [{
        email: String,
        role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
        expiresAt: Date
    }]
});

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided." });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token." });
    }
};

// --- AUTH ROUTES (Existing) ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, isVerified: true });
        await user.save();
        res.status(201).json({ success: true });
    } catch (e) { res.status(500).json({ error: "Signup failed" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials" });
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET, { expiresIn: '1h' });
        res.json({ token, userName: user.name, userId: user._id });
    } catch (e) { res.status(500).json({ error: "Login failed" }); }
});

// --- UPDATED DRIVE CONTENTS (Added Search) ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    try {
        const { folderId, tab, search, vaultUnlocked } = req.query;
        let filter = { owner: req.user.id, isTrash: false };
        let folderFilter = { owner: req.user.id, isTrash: false };

        // Handle Tabs
        if (tab === 'shared') {
            const sharedFiles = await File.find({ "sharedWith.email": req.user.email });
            return res.json({ folders: [], files: sharedFiles });
        }

        if (tab === 'starred') {
            filter.isStarred = true;
            folderFilter.isStarred = true;
        } else if (tab === 'trash') {
            filter.isTrash = true;
            folderFilter.isTrash = true;
        } else if (tab === 'vault') {
            if (vaultUnlocked !== 'true') return res.status(403).json({ error: "Vault Locked" });
            filter.isVault = true;
            folderFilter.isVault = true;
        } else {
            filter.isVault = false;
            folderFilter.isVault = false;
            filter.parentFolder = folderId === "null" ? null : folderId;
            folderFilter.parentFolder = folderId === "null" ? null : folderId;
        }

        // --- ADDED SEARCH LOGIC ---
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            filter.fileName = searchRegex;
            folderFilter.name = searchRegex;
            // When searching, we often want to look everywhere, so we remove folder constraints
            delete filter.parentFolder;
            delete folderFilter.parentFolder;
        }

        const [folders, files] = await Promise.all([
            Folder.find(folderFilter),
            File.find(filter)
        ]);

        res.json({ folders, files });
    } catch (e) { res.status(500).json({ error: "Load failed" }); }
});

// --- NEW: TOGGLE VAULT STATUS (Required for Drive.js action) ---
app.patch('/api/drive/toggle-vault/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { isVault } = req.body;
        const Model = type === 'file' ? File : Folder;
        const item = await Model.findOneAndUpdate(
            { _id: id, owner: req.user.id },
            { isVault, parentFolder: null }, // Moving to vault usually resets parent folder to root of vault
            { new: true }
        );
        if (!item) return res.status(404).json({ error: "Item not found" });
        res.json({ success: true, message: `Moved to ${isVault ? 'Vault' : 'Drive'}` });
    } catch (e) { res.status(500).json({ error: "Toggle vault failed" }); }
});

// --- ALL OTHER ROUTES (Keep as they were) ---
app.post('/api/folders', authenticate, async (req, res) => {
    try {
        const { name, parentFolder, isVault } = req.body;
        const folder = new Folder({ name, parentFolder: parentFolder || null, owner: req.user.id, isVault: isVault || false });
        await folder.save();
        res.status(201).json(folder);
    } catch (e) { res.status(500).json({ error: "Folder creation failed" }); }
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    try {
        const { itemId, type, targetId } = req.body;
        const Model = type === 'file' ? File : Folder;
        await Model.findOneAndUpdate({ _id: itemId, owner: req.user.id }, { parentFolder: targetId === 'root' ? null : targetId });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Move failed" }); }
});

app.post('/api/files/share', authenticate, async (req, res) => {
    try {
        const { fileId, email, role, hours } = req.body;
        const expiry = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
        await File.findOneAndUpdate(
            { _id: fileId, owner: req.user.id },
            { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiry } } }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Sharing failed" }); }
});

app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        if (type === 'file') {
            const file = await File.findOne({ _id: id, owner: req.user.id });
            if (!file) return res.status(404).json({ error: "Not found" });
            await supabase.storage.from(BUCKET_NAME).remove([file.s3Path]);
            await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } });
            await File.deleteOne({ _id: id });
        } else {
            await Folder.deleteOne({ _id: id, owner: req.user.id });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- UPLOAD LOGIC ---
const uploadMulter = multer({ dest: '/tmp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));

app.post('/api/upload/chunk', authenticate, uploadMulter.single('chunk'), (req, res) => {
    const tempFilePath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(tempFilePath, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path);
    res.json({ success: true });
});

app.post('/api/upload/complete', authenticate, async (req, res) => {
    const { fileName, uploadId, folderId, isVault, mimeType } = req.body;
    const tempFilePath = path.join('/tmp', `${uploadId}-${fileName}`);
    try {
        const stats = fs.statSync(tempFilePath);
        const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(s3Path, fs.readFileSync(tempFilePath), { contentType: mimeType });
        if (error) throw error;

        const file = new File({ fileName, fileSize: stats.size, s3Path, parentFolder: folderId || null, owner: req.user.id, isVault: isVault || false });
        await file.save();
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: stats.size } });
        fs.unlinkSync(tempFilePath);
        res.status(201).json(file);
    } catch (e) { res.status(500).json({ error: "Upload complete failed" }); }
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(file.s3Path, 3600);
        res.json({ url: data.signedUrl });
    } catch (e) { res.status(500).json({ error: "Preview failed" }); }
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ used: user.storageUsed, limit: user.storageLimit });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const { pin } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) {
        user.vaultPIN = await bcrypt.hash(pin, 10);
        await user.save();
        return res.json({ success: true });
    }
    if (await bcrypt.compare(pin, user.vaultPIN)) res.json({ success: true });
    else res.status(403).json({ error: "Incorrect PIN" });
});

app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
    const Model = req.params.type === 'file' ? File : Folder;
    await Model.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, { isStarred: req.body.isStarred });
    res.json({ success: true });
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    await User.findByIdAndDelete(req.user.id);
    res.json({ success: true });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));