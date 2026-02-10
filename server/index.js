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
const SECRET = process.env.JWT_SECRET || "CLOUDLY_FINAL_BOSS_2026"; // CHANGE THIS IN PRODUCTION
const BUCKET_NAME = 'cloudly'; // Your desired bucket name

// 1. Supabase S3 Setup - Fixed for Global Deployment
// Debugging S3 environment variables before Minio client initialization
console.log('DEBUG S3 Config:');
console.log('  process.env.S3_ENDPOINT:', process.env.S3_ENDPOINT);
console.log('  process.env.S3_ACCESS_KEY (first 5 chars):', (process.env.S3_ACCESS_KEY || 'N/A').substring(0, 5));
console.log('  process.env.S3_SECRET_KEY (first 5 chars):', (process.env.S3_SECRET_KEY || 'N/A').substring(0, 5));
console.log('  process.env.S3_REGION:', process.env.S3_REGION);

// Ensure s3Endpoint is robustly parsed or defaulted to prevent Minio client issues
const rawS3Endpoint = process.env.S3_ENDPOINT || '';
let s3Endpoint = '';
if (rawS3Endpoint.startsWith('https://')) {
    s3Endpoint = rawS3Endpoint.replace('https://', '').split('/')[0];
} else if (rawS3Endpoint) {
    // If it's present but doesn't start with https, assume it's just the hostname
    s3Endpoint = rawS3Endpoint.split('/')[0];
}
// Fallback if s3Endpoint is still empty (e.g., if S3_ENDPOINT was truly empty)
if (!s3Endpoint) {
    console.error('CRITICAL ERROR: S3_ENDPOINT environment variable is missing or malformed.');
    // You might want to exit the process here if S3 is mandatory for app startup
    // process.exit(1);
}
console.log('  Parsed s3Endpoint:', s3Endpoint);


const minioClient = new Minio.Client({
    endPoint: s3Endpoint,
    port: 443, // Default for HTTPS
    useSSL: true, // Always use SSL for production
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1', // Default region
    pathStyle: true // Important for Supabase and some other S3-compatible storage
});

// Function to ensure the bucket exists (useful for fresh deployments)
const ensureBucketExists = async () => {
    try {
        console.log(`Attempting to check/create bucket: '${BUCKET_NAME}' in region '${process.env.S3_REGION || 'us-east-1'}'`);
        const exists = await minioClient.bucketExists(BUCKET_NAME); // <<< UNCOMMENTED AND CORRECTED
        if (!exists) {
            await minioClient.makeBucket(BUCKET_NAME, process.env.S3_REGION || 'us-east-1'); // <<< UNCOMMENTED AND CORRECTED
            console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
            // You might want to set a public policy here if files are meant to be publicly accessible
            // For Supabase, RLS policies are typically managed in the Supabase dashboard directly.
        } else {
            console.log(`Bucket '${BUCKET_NAME}' already exists.`);
        }
    } catch (e) {
        console.error(`Error ensuring bucket '${BUCKET_NAME}' exists:`, e.message);
        // If bucket creation/check fails, it's often a critical issue.
        // Re-throwing the error to prevent the server from starting in a broken state.
        throw new Error(`S3 Bucket setup failed: ${e.message}`);
    }
};

// 2. Email Setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    // Use an App Password for Gmail, not your main password
    // Ensure less secure app access is enabled if not using App Password (not recommended)
    // For Render, ensure IP address resolution is not an issue (family: 4 often helps)
    family: 4
});

app.use(cors());
// Increased body limit for potential larger file metadata or base64 uploads (though we use chunks)
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
      console.log("Connected to MongoDB Cloud!");
      // Ensure S3 bucket exists AFTER DB connection is established
      return ensureBucketExists();
  })
  .then(() => {
      console.log("S3 Bucket setup confirmed.");
      // Start server ONLY after both DB and S3 are ready
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
  })
  .catch(err => {
      console.error("CRITICAL STARTUP ERROR: MongoDB or S3 Bucket Connection Error:", err.message);
      // Exit process if a critical dependency fails
      process.exit(1);
  });


// 3. SCHEMAS
const User = mongoose.model('User', {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    vaultPIN: String,
    isVerified: { type: Boolean, default: true }, // Verified by default, OTP for recovery
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
    s3Path: String, // Changed from 'path' to 's3Path' to avoid conflict with Node.js path module
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
        const user = new User({ name, email, password: hashedPassword, isVerified: true }); // No OTP for initial signup
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
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
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
        user.otpExpires = Date.now() + 600000; // OTP valid for 10 minutes
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
            otpExpires: { $gt: Date.now() } // OTP must not be expired
        });
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined; // Clear OTP after use
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

        // Delete files from S3
        for (let f of files) {
            try {
                await minioClient.removeObject(BUCKET_NAME, f.s3Path);
            } catch (s3Err) {
                console.warn(`Could not delete file ${f.s3Path} from S3: ${s3Err.message}`);
                // Continue even if one file fails to delete from S3
            }
        }
        // Delete all user data from MongoDB
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
        let filter = { owner: req.user.id, isTrash: false }; // Default filter
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
            filter.isStarred = { $ne: true }; // Don't show starred items in trash unless specifically starred in trash
            folderFilter.isStarred = { $ne: true };
        } else if (tab === 'vault') {
            const user = await User.findById(req.user.id);
            if (!user || !req.query.vaultUnlocked) { // Frontend should send vaultUnlocked=true after PIN entry
                return res.status(403).json({ error: "Vault access denied. Please unlock your vault." });
            }
            filter.isVault = true;
            folderFilter.isVault = true;
        } else { // 'files' or root view
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

        // Prevent duplicate shares to the same email
        const existingShareIndex = file.sharedWith.findIndex(s => s.email === newShare.email);
        if (existingShareIndex > -1) {
            file.sharedWith[existingShareIndex] = newShare; // Update existing share
        } else {
            file.sharedWith.push(newShare); // Add new share
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
                await minioClient.removeObject(BUCKET_NAME, file.s3Path);
                await User.findByIdAndUpdate(userId, { $inc: { storageUsed: -file.fileSize } }); // Decrement storage
            } catch (s3Err) {
                console.error(`S3 deletion failed for file ${file.s3Path}: ${s3Err.message}`);
                // Still proceed to delete DB entry as S3 might be out of sync or partially deleted
            }
            await File.deleteOne({ _id: id });
            res.json({ success: true, message: "File deleted successfully." });
        } else if (type === 'folder') {
            const folder = await Folder.findOne({ _id: id, owner: userId });
            if (!folder) {
                return res.status(404).json({ error: "Folder not found or you don't own it." });
            }
            // Logic to delete contents of the folder recursively (for simplicity, only deletes empty folders for now)
            // In a real app, you'd iterate and delete nested files/folders from S3 and DB
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
const upload = multer({ dest: '/tmp/' }); // Use /tmp for Render's ephemeral storage

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
    try {
        const { fileName, uploadId, folderId, isVault } = req.body;
        if (!fileName || !uploadId) {
            return res.status(400).json({ error: "Filename and upload ID are required for completion." });
        }

        const tempFileName = `${uploadId}-${fileName}`;
        const tempFilePath = path.join('/tmp', tempFileName);

        if (!fs.existsSync(tempFilePath)) {
            return res.status(404).json({ error: "Temporary file not found, upload might have failed earlier." });
        }

        const fileStats = fs.statSync(tempFilePath);
        const fileSize = fileStats.size;

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (user.storageUsed + fileSize > user.storageLimit) {
            fs.unlinkSync(tempFilePath); // Clean up temp file
            return res.status(403).json({ error: "Storage limit exceeded." });
        }

        // Generate a unique S3 path for the file (e.g., user_id/file_id-filename)
        const s3ObjectPath = `${req.user.id}/${Date.now()}-${fileName}`;

        // Using fPutObject to upload from a local file path to S3
        await minioClient.fPutObject(BUCKET_NAME, s3ObjectPath, tempFilePath);

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

        fs.unlinkSync(tempFilePath); // Clean up temporary file after successful S3 upload
        res.status(201).json(file);
    } catch (e) {
        console.error("Upload complete failed:", e);
        res.status(500).json({ error: "Failed to complete upload due to a server error: " + e.message });
    }
});

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ error: "File not found." });
        }

        // Check ownership or shared access
        const isOwner = file.owner.toString() === req.user.id;
        const isShared = file.sharedWith.some(
            s => s.email === req.user.email && (!s.expiresAt || new Date() < s.expiresAt)
        );

        if (!isOwner && !isShared) {
            return res.status(403).json({ error: "You do not have permission to view this file." });
        }

        const presignedUrl = await minioClient.presignedUrl('GET', BUCKET_NAME, file.s3Path, 3600); // URL valid for 1 hour
        res.json({ url: presignedUrl });
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
            // First time setting PIN
            user.vaultPIN = await bcrypt.hash(pin, 10);
            await user.save();
            return res.json({ success: true, message: "Vault PIN set successfully." });
        }

        // Comparing existing PIN
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

// Generic route for updating starred status
app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { isStarred } = req.body; // Expect boolean true/false

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

// Middleware for handling 404 (Not Found) errors
app.use((req, res, next) => {
    res.status(404).json({ error: "API endpoint not found." });
});

// Global error handler (should be the last app.use)
app.use((err, req, res, next) => {
    console.error("Global server error:", err.stack);
    res.status(500).json({ error: "An unexpected server error occurred." });
});

// Removed app.listen from the global scope and moved it into the .then() block
// of the mongoose.connect promise chain to ensure all services are ready.