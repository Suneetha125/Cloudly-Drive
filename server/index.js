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
const { createClient } = require('@supabase/supabase-js'); // Import Supabase client

const app = express();
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026"; // CHANGE THIS IN PRODUCTION!
const BUCKET_NAME = 'cloudly'; // Your Supabase Storage bucket name

// --- Supabase Client Setup (REPLACING MINIO CLIENT) ---
console.log('DEBUG Supabase Config:');
console.log('  process.env.SUPABASE_URL:', process.env.SUPABASE_URL);
// Using S3_SECRET_KEY for the Supabase service_role key to maintain your existing env setup
console.log('  process.env.S3_SECRET_KEY (first 5 chars):', (process.env.S3_SECRET_KEY || 'N/A').substring(0, 5));

if (!process.env.SUPABASE_URL || !process.env.S3_SECRET_KEY) {
    console.error('CRITICAL ERROR: SUPABASE_URL or S3_SECRET_KEY environment variables are missing. Exiting.');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.S3_SECRET_KEY, // This is your service_role JWT
    {
        auth: {
            persistSession: false, // Important for backend services
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    }
);
// --- END Supabase Client Setup ---

// 2. Email Setup
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
      console.log("Supabase Storage client initialized. Server starting.");
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
  })
  .catch(err => {
      console.error("CRITICAL STARTUP ERROR: MongoDB Connection Error:", err.message);
      process.exit(1);
  });


// 3. SCHEMAS
const User = mongoose.model('User', {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    vaultPIN: String,
    isVerified: { type: Boolean, default: true },
    otp: String,
    otpExpires: Date,
    storageUsed: { type: Number, default: 0 },
    storageLimit: { type: Number, default: 32212254720 } // 30 GB in bytes
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
    s3Path: String, // Will now be the path within the Supabase bucket
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
        return res.status(401).json({ error: "Authentication denied: No token provided." });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded; // { id: user._id, email: user.email }
        next();
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return res.status(401).json({ error: "Authentication failed: Invalid token." });
    }
};

// --- AUTH & RECOVERY ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required for registration." });
        }
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: "An account with this email already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, isVerified: true });
        await user.save();
        res.status(201).json({ success: true, message: "Registration successful!" });
    } catch (e) {
        console.error("Signup failed:", e);
        res.status(500).json({ error: "Registration failed due to a server error." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid credentials." });
        }
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET, { expiresIn: '1h' });
        res.json({ token, userName: user.name, userId: user._id });
    } catch (e) {
        console.error("Login failed:", e);
        res.status(500).json({ error: "Login failed due to a server error." });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 600000;
        await user.save();

        await transporter.sendMail({
            to: email,
            subject: "Cloudly Password Recovery",
            text: `Your password reset code is: ${otp}\nThis code is valid for 10 minutes.`
        });
        res.json({ message: "Password recovery OTP sent to your email." });
    } catch (e) {
        console.error("Forgot password failed:", e);
        res.status(500).json({ error: "Failed to send OTP. Please try again later." });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "Email, OTP, and new password are required." });
        }
        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        res.json({ success: true, message: "Password reset successful!" });
    } catch (e) {
        console.error("Reset password failed:", e);
        res.status(500).json({ error: "Failed to reset password due to a server error." });
    }
});

app.delete('/api/auth/delete-account', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const files = await File.find({ owner: userId });

        for (let f of files) {
            try {
                // --- Supabase Storage: Delete Object ---
                const { error: deleteError } = await supabase
                    .storage
                    .from(BUCKET_NAME)
                    .remove([f.s3Path]); // path within the bucket

                if (deleteError) {
                    console.warn(`Supabase Storage deletion failed for file ${f.s3Path}: ${deleteError.message}`);
                }
            } catch (storageErr) {
                console.warn(`Supabase Storage deletion failed for file ${f.s3Path}: ${storageErr.message}`);
            }
        }
        await File.deleteMany({ owner: userId });
        await Folder.deleteMany({ owner: userId });
        await User.findByIdAndDelete(userId);

        res.json({ success: true, message: "Account and all associated data deleted successfully." });
    } catch (e) {
        console.error("Account deletion failed:", e);
        res.status(500).json({ error: "Failed to delete account due to a server error." });
    }
});

// --- DRIVE LOGIC ---
app.get('/api/drive/contents', authenticate, async (req, res) => {
    try {
        const { folderId, tab } = req.query;
        let filter = { owner: req.user.id, isTrash: false };
        let folderFilter = { owner: req.user.id, isTrash: false };

        if (tab === 'shared') {
            const sharedFiles = await File.find({ "sharedWith.email": req.user.email });
            const validSharedFiles = sharedFiles.filter(f => {
                const access = f.sharedWith.find(a => a.email === req.user.email);
                return access && (!access.expiresAt || new Date() < access.expiresAt);
            });
            return res.json({ folders: [], files: validSharedFiles });
        }

        if (tab === 'starred') {
            filter.isStarred = true;
            folderFilter.isStarred = true;
        } else if (tab === 'trash') {
            filter.isTrash = true;
            folderFilter.isTrash = true;
            filter.isStarred = { $ne: true };
            folderFilter.isStarred = { $ne: true };
        } else if (tab === 'vault') {
            const user = await User.findById(req.user.id);
            if (!user || !req.query.vaultUnlocked) {
                return res.status(403).json({ error: "Vault access denied. Please unlock your vault." });
            }
            filter.isVault = true;
            folderFilter.isVault = true;
        } else {
            filter.isVault = false;
            folderFilter.isVault = false;
            filter.parentFolder = folderId === "null" ? null : folderId;
            folderFilter.parentFolder = folderId === "null" ? null : folderId;
        }

        const folders = await Folder.find(folderFilter);
        const files = await File.find(filter);

        res.json({ folders, files });
    } catch (e) {
        console.error("Failed to fetch drive contents:", e);
        res.status(500).json({ error: "Failed to load drive contents." });
    }
});

app.post('/api/folders', authenticate, async (req, res) => {
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
        console.error("Failed to create folder:", e);
        res.status(500).json({ error: "Failed to create folder." });
    }
});

app.patch('/api/drive/move', authenticate, async (req, res) => {
    try {
        const { itemId, type, targetId } = req.body;
        if (!itemId || !type) return res.status(400).json({ error: "Item ID and type are required." });

        const Model = type === 'file' ? File : Folder;
        const update = { parentFolder: targetId === 'root' ? null : targetId };

        const item = await Model.findOneAndUpdate(
            { _id: itemId, owner: req.user.id },
            update,
            { new: true }
        );

        if (!item) return res.status(404).json({ error: `${type} not found or you don't own it.` });

        res.json({ success: true, message: `${type} moved successfully.` });
    } catch (e) {
        console.error("Failed to move item:", e);
        res.status(500).json({ error: "Failed to move item." });
    }
});


app.post('/api/files/share', authenticate, async (req, res) => {
    try {
        const { fileId, email, role, hours } = req.body;
        if (!fileId || !email || !role) {
            return res.status(400).json({ error: "File ID, email, and role are required for sharing." });
        }
        const file = await File.findOne({ _id: fileId, owner: req.user.id });
        if (!file) {
            return res.status(404).json({ error: "File not found or you are not the owner." });
        }

        const expiry = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
        const newShare = { email: email.toLowerCase(), role, expiresAt: expiry };

        const existingShareIndex = file.sharedWith.findIndex(s => s.email === newShare.email);
        if (existingShareIndex > -1) {
            file.sharedWith[existingShareIndex] = newShare;
        } else {
            file.sharedWith.push(newShare);
        }
        await file.save();
        res.json({ success: true, message: "File sharing updated successfully." });
    } catch (e) {
        console.error("Failed to share file:", e);
        res.status(500).json({ error: "Failed to share file due to a server error." });
    }
});


app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.id;

        if (type === 'file') {
            const file = await File.findOne({ _id: id, owner: userId });
            if (!file) {
                return res.status(404).json({ error: "File not found or you don't own it." });
            }
            try {
                // --- Supabase Storage: Delete Object ---
                const { error: deleteError } = await supabase
                    .storage
                    .from(BUCKET_NAME)
                    .remove([file.s3Path]); // path within the bucket

                if (deleteError) {
                    console.error(`Supabase Storage deletion failed for file ${file.s3Path}: ${deleteError.message}`);
                    return res.status(500).json({ error: `Failed to delete file from storage: ${deleteError.message}` });
                }
                await User.findByIdAndUpdate(userId, { $inc: { storageUsed: -file.fileSize } });
            } catch (storageErr) {
                console.error(`Supabase Storage deletion failed for file ${file.s3Path}: ${storageErr.message}`);
                return res.status(500).json({ error: `Failed to delete file from storage: ${storageErr.message}` });
            }
            await File.deleteOne({ _id: id });
            res.json({ success: true, message: "File deleted successfully." });
        } else if (type === 'folder') {
            const folder = await Folder.findOne({ _id: id, owner: userId });
            if (!folder) {
                return res.status(404).json({ error: "Folder not found or you don't own it." });
            }
            const childFiles = await File.find({ parentFolder: id, owner: userId });
            const childFolders = await Folder.find({ parentFolder: id, owner: userId });

            if (childFiles.length > 0 || childFolders.length > 0) {
                 return res.status(400).json({ error: "Folder is not empty. Please delete its contents first." });
            }

            await Folder.deleteOne({ _id: id });
            res.json({ success: true, message: "Folder deleted successfully." });
        } else {
            res.status(400).json({ error: "Invalid deletion type specified." });
        }
    } catch (e) {
        console.error(`Deletion failed for ${req.params.type} ${req.params.id}:`, e);
        res.status(500).json({ error: "Failed to delete item due to a server error." });
    }
});


// --- UPLOAD & STORAGE ---
const upload = multer({ dest: '/tmp/' });

app.post('/api/upload/initialize', authenticate, (req, res) => {
    try {
        res.json({ uploadId: Date.now().toString() });
    } catch (e) {
        console.error("Upload initialize failed:", e);
        res.status(500).json({ error: "Failed to initialize upload." });
    }
});

app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No chunk file provided." });
        if (!req.body.uploadId || !req.body.fileName) {
            return res.status(400).json({ error: "Upload ID and filename are required for chunk." });
        }

        const tempFileName = `${req.body.uploadId}-${req.body.fileName}`;
        const tempFilePath = path.join('/tmp', tempFileName);

        // Append the chunk to the temporary file
        fs.appendFileSync(tempFilePath, fs.readFileSync(req.file.path));

        // Delete the temporary multer chunk file
        fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch (e) {
        console.error("Upload chunk failed:", e);
        res.status(500).json({ error: "Failed to upload chunk: " + e.message });
    }
});


app.post('/api/upload/complete', authenticate, async (req, res) => {
    const { fileName, uploadId, folderId, isVault, mimeType } = req.body; // Added mimeType
    const tempFileName = `${uploadId}-${fileName}`;
    const tempFilePath = path.join('/tmp', tempFileName);

    try {
        if (!fileName || !uploadId || !mimeType) { // mimeType is crucial for Supabase upload
            return res.status(400).json({ error: "Filename, upload ID, and MIME type are required for completion." });
        }

        if (!fs.existsSync(tempFilePath)) {
            console.error(`UPLOAD COMPLETE ERROR: Temporary file not found at ${tempFilePath}`);
            return res.status(404).json({ error: "Temporary file not found, upload might have failed earlier or was not fully chunked." });
        }

        const fileStats = fs.statSync(tempFilePath);
        const fileSize = fileStats.size;

        const user = await User.findById(req.user.id);
        if (!user) {
            fs.unlinkSync(tempFilePath);
            return res.status(404).json({ error: "User not found." });
        }

        if (user.storageUsed + fileSize > user.storageLimit) {
            fs.unlinkSync(tempFilePath);
            return res.status(403).json({ error: "Storage limit exceeded." });
        }

        // --- Supabase Storage: Upload Object ---
        const s3ObjectPath = `${req.user.id}/${Date.now()}-${fileName}`; // Path within the bucket
        const fileBuffer = fs.readFileSync(tempFilePath); // Read the complete file into a buffer

        console.log(`Attempting Supabase Storage upload for file: ${fileName} to path: ${s3ObjectPath} with MIME: ${mimeType}`);

        const { data, error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(s3ObjectPath, fileBuffer, {
                contentType: mimeType,
                upsert: false // Set to true if you want to overwrite existing files
            });

        if (uploadError) {
            console.error(`SUPABASE UPLOAD FAILED: ${uploadError.message}`);
            // If Supabase provides specific error details, include them
            console.error(`Supabase Error Detail:`, JSON.stringify(uploadError, null, 2));
            fs.unlinkSync(tempFilePath);
            return res.status(500).json({ error: `Failed to upload file to storage: ${uploadError.message}` });
        }
        // --- END Supabase Storage: Upload Object ---

        const file = new File({
            fileName,
            fileSize,
            s3Path: s3ObjectPath,
            parentFolder: folderId || null,
            owner: req.user.id,
            isVault: isVault || false
        });
        await file.save();

        await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fileSize } });

        res.status(201).json(file);
    } catch (e) {
        console.error("UPLOAD COMPLETE FAILED SERVER-SIDE (Catch Block):");
        console.error(`  Error uploading file ${fileName} for user ${req.user.id}:`);
        console.error(`  Error message: ${e.message}`);
        console.error(`  Error code: ${e.code}`); // Note: Supabase errors have their own structure
        console.error(`  Error name: ${e.name}`);
        console.error(`  Full error object:`, JSON.stringify(e, null, 2));

        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupErr) {
                console.error(`Error cleaning up temporary file ${tempFilePath}: ${cleanupErr.message}`);
            }
        }

        res.status(500).json({ error: "Failed to complete upload due to a server error. Please check server logs for details." });
    }
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ error: "File not found." });
        }

        const isOwner = file.owner.toString() === req.user.id;
        const isShared = file.sharedWith.some(
            s => s.email === req.user.email && (!s.expiresAt || new Date() < s.expiresAt)
        );

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: "You do not have permission to view this file." });
        }

        // --- Supabase Storage: Get Presigned URL ---
        const { data, error: urlError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .createSignedUrl(file.s3Path, 3600); // URL valid for 1 hour (3600 seconds)

        if (urlError) {
            console.error(`SUPABASE PRESIGNED URL FAILED: ${urlError.message}`);
            return res.status(500).json({ error: `Failed to generate preview URL: ${urlError.message}` });
        }
        res.json({ url: data.signedUrl });
        // --- END Supabase Storage: Get Presigned URL ---

    } catch (e) {
        console.error("Failed to get preview URL:", e);
        res.status(500).json({ error: "Failed to generate preview URL." });
    }
});

app.get('/api/drive/storage', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });
        res.json({ used: user.storageUsed, limit: user.storageLimit });
    } catch (e) {
        console.error("Failed to fetch storage info:", e);
        res.status(500).json({ error: "Failed to retrieve storage information." });
    }
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: "PIN is required." });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (!user.vaultPIN) {
            user.vaultPIN = await bcrypt.hash(pin, 10);
            await user.save();
            return res.json({ success: true, message: "Vault PIN set successfully." });
        }

        if (await bcrypt.compare(pin, user.vaultPIN)) {
            res.json({ success: true, message: "Vault unlocked successfully." });
        } else {
            res.status(403).json({ error: "Incorrect Vault PIN." });
        }
    } catch (e) {
        console.error("Vault unlock failed:", e);
        res.status(500).json({ error: "Failed to unlock vault due to a server error." });
    }
});

app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { isStarred } = req.body;

        const Model = type === 'file' ? File : Folder;
        const item = await Model.findOneAndUpdate(
            { _id: id, owner: req.user.id },
            { isStarred },
            { new: true }
        );

        if (!item) return res.status(404).json({ error: `${type} not found or you don't own it.` });

        res.json({ success: true, message: `${type} star status updated.` });
    } catch (e) {
        console.error(`Failed to update ${type} star status:`, e);
        res.status(500).json({ error: "Failed to update star status." });
    }
});

app.use((req, res, next) => {
    res.status(404).json({ error: "API endpoint not found." });
});

app.use((err, req, res, next) => {
    console.error("Global server error:", err.stack);
    res.status(500).json({ error: "An unexpected server error occurred." });
});