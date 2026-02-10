// server.js (UPDATED)
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
const nodemailer = require('nodemailer'); // For password recovery, not initial signup verification

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026";
const BUCKET_NAME = 'cloudly'; // Ensure this bucket exists in your Supabase S3

// 1. Supabase S3 Setup - CRITICAL: Ensure S3_ENDPOINT is correct and Minio client can reach it.
// Supabase S3 endpoint usually looks like: [project-ref].supabase.co
// For Minio, you'd typically use just the host, and if pathStyle is true, it might prepend the bucket name.
// Let's ensure the endpoint parsing is robust.
const s3Host = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : '127.0.0.1'; // Extract hostname
const s3Port = process.env.S3_ENDPOINT && new URL(process.env.S3_ENDPOINT).port ? parseInt(new URL(process.env.S3_ENDPOINT).port) : 443;
const s3UseSSL = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).protocol === 'https:' : true;

const minioClient = new Minio.Client({
    endPoint: s3Host,
    port: s3Port,
    useSSL: s3UseSSL,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1', // Ensure region is correct for your Supabase bucket
    // pathStyle: true // Supabase S3 usually works better without pathStyle: true, or with virtual-hosted style
});

// Create bucket if it doesn't exist (only once on startup or when needed)
async function ensureBucketExists(bucketName) {
    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, process.env.S3_REGION);
            console.log(`Bucket '${bucketName}' created successfully.`);
        } else {
            console.log(`Bucket '${bucketName}' already exists.`);
        }
    } catch (err) {
        console.error(`--- BUCKET EXISTENCE CHECK ERROR ---`);
        console.error(`Error ensuring bucket '${bucketName}' exists:`, err.message);
        console.error("Error Code:", err.code);
        console.error("Error Name:", err.name);
        console.error("Stack Trace:", err.stack);
        console.error("Full Error Object:", JSON.stringify(err, null, 2));
        console.error(`--- END BUCKET EXISTENCE CHECK ERROR ---`);
    }
}
ensureBucketExists();


// 2. Email Setup - Fixed IPv6 Error for Render
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    family: 4 // This helps with IPv4 preference on some hosts
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB Cloud!"))
  .catch(err => console.log("Cloud Connection Error:", err));

// 3. SCHEMAS
const User = mongoose.model('User', { 
    name: String, 
    email: { type: String, unique: true, lowercase: true, trim: true }, // Ensure consistent email format
    password: String, 
    vaultPIN: String, 
    isVerified: { type: Boolean, default: true }, // Removed initial signup verification as per request
    otp: String, 
    otpExpires: Date, 
    storageUsed: { type: Number, default: 0 }
});
const Folder = mongoose.model('Folder', { 
    name: String, 
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    isStarred: { type: Boolean, default: false }, 
    isVault: { type: Boolean, default: false }, 
    isTrash: { type: Boolean, default: false } 
});
const File = mongoose.model('File', { 
    fileName: String, 
    fileSize: Number, 
    path: String, // Path in S3 bucket
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    isStarred: { type: Boolean, default: false }, 
    isVault: { type: Boolean, default: false }, 
    isTrash: { type: Boolean, default: false }, 
    sharedWith: [{ 
        email: { type: String, lowercase: true, trim: true }, 
        role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' }, 
        expiresAt: Date 
    }] 
});

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Authentication Denied: No token provided or invalid format.");
    }
    const token = authHeader.split(" ")[1];
    try { 
        req.user = jwt.verify(token, SECRET); 
        next(); 
    } catch (err) { 
        console.error("JWT Verification Error:", err.message);
        return res.status(401).send("Authentication Invalid: Invalid or expired token."); 
    }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required." });
        }
        const userEmail = email.toLowerCase().trim();
        const exists = await User.findOne({ email: userEmail });
        if (exists) {
            return res.status(400).json({ error: "An account with this email already exists." });
        }
        
        // Removed OTP verification for signup as requested
        const user = new User({ 
            name, 
            email: userEmail, 
            password: await bcrypt.hash(password, 10), 
            isVerified: true // User is immediately verified
        });
        await user.save(); 
        // Auto-login after registration for convenience
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
        res.status(201).json({ success: true, token, userName: user.name, message: "Registration successful!" });
    } catch (e) { 
        console.error("Signup error:", e);
        res.status(500).json({ error: "Registration failed due to a server error." }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        const userEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password." });
        }
        // If not verified and verification is enabled (currently disabled)
        // if (!user.isVerified) return res.status(403).json({ error: "Account not verified. Please check your email for OTP." });

        res.json({ token: jwt.sign({ id: user._id, email: user.email }, SECRET), userName: user.name });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Login failed due to a server error." });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp; 
        user.otpExpires = Date.now() + 600000; // OTP valid for 10 minutes
        await user.save();
        await transporter.sendMail({ 
            from: process.env.EMAIL_USER,
            to: email, 
            subject: "Cloudly Password Recovery", 
            text: `Your Cloudly password reset code is: ${otp}\nThis code is valid for 10 minutes.` 
        });
        res.json({ message: "Password recovery OTP sent to your email." });
    } catch (e) {
        console.error("Forgot password error:", e);
        res.status(500).json({ error: "Failed to send OTP. Please try again later." });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "Email, OTP, and new password are required." });
        }
        const user = await User.findOne({ email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined; // Clear OTP after successful reset
        user.otpExpires = undefined;
        await user.save();
        res.json({ success: true, message: "Password reset successful!" });
    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: "Failed to reset password. Please try again later." });
    }
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        // Find and delete all files owned by the user from S3 and MongoDB
        const files = await File.find({ owner: userId });
        for (let f of files) { 
            try { 
                await minioClient.removeObject(BUCKET_NAME, f.path); 
            } catch(e) {
                console.warn(`Could not delete S3 object ${f.path}:`, e.message);
            } 
        }
        await File.deleteMany({ owner: userId });
        await Folder.deleteMany({ owner: userId });
        await User.findByIdAndDelete(userId);
        res.json({ success: true, message: "Account and all associated data deleted." });
    } catch (e) {
        console.error("Account deletion error:", e);
        res.status(500).json({ error: "Failed to delete account. Please try again." });
    }
});

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let fileFilter = { owner: req.user.id };
    let folderFilter = { owner: req.user.id };

    if (tab === 'shared') {
        // Files shared *with* the current user
        const sharedFiles = await File.find({ "sharedWith.email": req.user.email });
        return res.json({ folders: [], files: sharedFiles.filter(f => {
            const access = f.sharedWith.find(a => a.email === req.user.email);
            return access && (!access.expiresAt || new Date() < access.expiresAt);
        })});
    } else if (tab === 'starred') {
        fileFilter.isStarred = true;
        folderFilter.isStarred = true;
    } else if (tab === 'trash') {
        fileFilter.isTrash = true;
        folderFilter.isTrash = true;
    } else if (tab === 'vault') {
        fileFilter.isVault = true;
        folderFilter.isVault = true;
    } else { // My Drive
        fileFilter.isVault = false;
        fileFilter.isTrash = false;
        fileFilter.parentFolder = folderId === "null" ? null : folderId;

        folderFilter.isVault = false;
        folderFilter.isTrash = false;
        folderFilter.parentFolder = folderId === "null" ? null : folderId;
    }

    try {
        const folders = await Folder.find(folderFilter);
        const files = await File.find(fileFilter);
        res.json({ folders, files });
    } catch (e) {
        console.error("Error fetching drive contents:", e);
        res.status(500).json({ error: "Failed to fetch drive contents." });
    }
});

app.post('/api/folders', authenticate, async (req, res) => { // Renamed from /api/drive/folder for consistency
    try {
        const { name, parentFolder, isVault } = req.body;
        if (!name) return res.status(400).json({ error: "Folder name is required." });
        const folder = new Folder({ 
            name, 
            parentFolder: parentFolder || null, 
            owner: req.user.id, 
            isVault: isVault || false 
        });
        await folder.save(); 
        res.status(201).json(folder);
    } catch (e) {
        console.error("Error creating folder:", e);
        res.status(500).json({ error: "Failed to create folder." });
    }
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    try {
        const { type, itemId, targetId } = req.body;
        const Model = type === 'file' ? File : Folder;
        const update = { parentFolder: targetId === 'root' ? null : targetId };

        const item = await Model.findOneAndUpdate(
            { _id: itemId, owner: req.user.id }, // Ensure user owns the item
            update,
            { new: true }
        );
        if (!item) return res.status(404).json({ error: "Item not found or not owned by user." });
        res.json({ success: true, message: "Item moved successfully." });
    } catch (e) {
        console.error("Error moving item:", e);
        res.status(500).json({ error: "Failed to move item." });
    }
});

app.post('/api/files/share', authenticate, async (req, res) => { // Endpoint for sharing
    try {
        const { fileId, email, role, hours } = req.body;
        if (!fileId || !email || !role) {
            return res.status(400).json({ error: "File ID, email, and role are required." });
        }
        const expiryDate = hours > 0 ? new Date(Date.now() + hours * 3600000) : null; // Hours to milliseconds
        
        const file = await File.findOneAndUpdate(
            { _id: fileId, owner: req.user.id }, // Only owner can share
            { $push: { sharedWith: { email: email.toLowerCase(), role, expiresAt: expiryDate } } },
            { new: true }
        );
        if (!file) return res.status(404).json({ error: "File not found or not owned by user." });
        res.json({ success: true, message: "File shared successfully." });
    } catch (e) {
        console.error("Error sharing file:", e);
        res.status(500).json({ error: "Failed to share file." });
    }
});

app.delete('/api/files/:id', authenticate, async (req, res) => { // Unified delete file
    try {
        const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
        if (!file) {
            return res.status(404).json({ error: "File not found or not owned by user." });
        }

        await minioClient.removeObject(BUCKET_NAME, file.path);
        await File.deleteOne({ _id: file._id });
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } }); // Deduct storage
        res.json({ success: true, message: "File deleted successfully." });
    } catch (e) {
        console.error("Error deleting file:", e);
        res.status(500).json({ error: "Failed to delete file." });
    }
});

app.delete('/api/folders/:id', authenticate, async (req, res) => { // Unified delete folder
    try {
        const folder = await Folder.findOne({ _id: req.params.id, owner: req.user.id });
        if (!folder) {
            return res.status(404).json({ error: "Folder not found or not owned by user." });
        }
        // Recursively delete contents (files and subfolders)
        const deleteContents = async (currentFolderId) => {
            const childFiles = await File.find({ parentFolder: currentFolderId, owner: req.user.id });
            for (const file of childFiles) {
                try {
                    await minioClient.removeObject(BUCKET_NAME, file.path);
                    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: -file.fileSize } });
                } catch(e) { console.warn(`Could not delete S3 object ${file.path}:`, e.message); }
                await File.deleteOne({ _id: file._id });
            }
            const childFolders = await Folder.find({ parentFolder: currentFolderId, owner: req.user.id });
            for (const childFolder of childFolders) {
                await deleteContents(childFolder._id); // Recurse for subfolders
                await Folder.deleteOne({ _id: childFolder._id });
            }
        };

        await deleteContents(folder._id); // Delete contents of the main folder
        await Folder.deleteOne({ _id: folder._id }); // Delete the main folder itself
        res.json({ success: true, message: "Folder and its contents deleted successfully." });
    } catch (e) {
        console.error("Error deleting folder:", e);
        res.status(500).json({ error: "Failed to delete folder." });
    }
});

// --- UPLOAD & STORAGE ---
const upload = multer({ dest: '/tmp/' }); // Files are temporarily stored here
app.post('/api/upload/initialize', authenticate, (req, res) => {
    res.json({ uploadId: Date.now().toString() }); // Simple unique ID for upload
});

app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No chunk file provided." });
    if (!req.body.uploadId || !req.body.fileName) return res.status(400).json({ error: "Missing uploadId or fileName." });

    const tempFilePath = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
    try {
        fs.appendFileSync(tempFilePath, fs.readFileSync(req.file.path));
        fs.unlinkSync(req.file.path); // Remove the temporary chunk
        res.json({ success: true });
    } catch (e) {
        console.error("Error appending chunk:", e);
        res.status(500).json({ error: "Failed to process chunk." });
    }
});

app.post('/api/upload/complete', authenticate, async (req, res) => {
    try {
        const name = `${req.body.uploadId}-${req.body.fileName}`;
        const tPath = path.join('/tmp', name);

        // This is the line that's probably throwing the S3Error:
        await minioClient.fPutObject(BUCKET_NAME, name, tPath);

        const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === true });
        await file.save();
        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fs.statSync(tPath).size } });
        fs.unlinkSync(tPath);
        res.json(file);
    } catch (err) {
        console.error("--- UPLOAD COMPLETE ERROR DETAILS ---");
        console.error("Error Message:", err.message);
        console.error("Error Code:", err.code); // Minio S3 errors often have a code
        console.error("Error Name:", err.name);
        console.error("Stack Trace:", err.stack);
        console.error("Minio S3 Error Object:", JSON.stringify(err, null, 2)); // Stringify the full error object
        console.error("--- END UPLOAD COMPLETE ERROR DETAILS ---");

        // Send a more informative error message to the frontend if possible
        const errorMessage = err.message || "Unknown upload error";
        res.status(500).json({ error: `Upload failed: ${errorMessage}` });
    }
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => { // Renamed for consistency
    try {
        const file = await File.findOne({ _id: req.params.id, owner: req.user.id }); // Only owner can preview
        if (!file) {
            // Also check if file is shared with the user
            const sharedFile = await File.findOne({ _id: req.params.id, "sharedWith.email": req.user.email });
            if (!sharedFile) return res.status(404).json({ error: "File not found or you don't have access." });
            
            const access = sharedFile.sharedWith.find(a => a.email === req.user.email);
            if (!access || (access.expiresAt && new Date() > access.expiresAt)) {
                return res.status(403).json({ error: "Access to this shared file has expired or is invalid." });
            }
            // If shared, allow preview
            const url = await minioClient.presignedUrl('GET', BUCKET_NAME, sharedFile.path, 3600); // 1 hour expiry
            return res.json({ url });

        }
        const url = await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600); // 1 hour expiry
        res.json({ url });
    } catch (e) {
        console.error("Error generating preview URL:", e);
        res.status(500).json({ error: "Failed to generate preview URL." });
    }
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });
        res.json({ used: user.storageUsed, limit: 32212254720 }); // 30GB limit
    } catch (e) {
        console.error("Error fetching storage info:", e);
        res.status(500).json({ error: "Failed to fetch storage information." });
    }
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    try {
        const { pin } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (!user.vaultPIN) { // First time setting vault PIN
            if (!pin) return res.status(400).json({ error: "PIN is required to set up vault." });
            user.vaultPIN = await bcrypt.hash(pin, 10); 
            await user.save(); 
            return res.json({ success: true, message: "Vault PIN set successfully." });
        }

        // Existing vault PIN
        if (!pin || !(await bcrypt.compare(pin, user.vaultPIN))) {
            return res.status(403).json({ error: "Wrong PIN." });
        }
        res.json({ success: true, message: "Vault unlocked." });
    } catch (e) {
        console.error("Vault unlock error:", e);
        res.status(500).json({ error: "Failed to unlock vault." });
    }
});

// Default route for unhandled requests (e.g., /api/auth/nuclear-reset)
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}. This endpoint does not exist.` });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));