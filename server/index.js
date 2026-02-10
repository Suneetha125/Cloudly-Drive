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

/* -------------------- SUPABASE S3 (SAFE CONFIG) -------------------- */

// REQUIRED ENV CHECK (prevents silent S3Error)
['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].forEach(k => {
  if (!process.env[k]) {
    console.error(`❌ Missing env var: ${k}`);
    process.exit(1);
  }
});

// ✅ Use FULL hostname (NO URL parsing)
const minioClient = new Minio.Client({
  endPoint: process.env.S3_ENDPOINT.replace(/^https?:\/\//, ''),
  useSSL: true,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION || 'us-east-1',
  pathStyle: true
});

/* -------------------- EMAIL -------------------- */

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* -------------------- MIDDLEWARE -------------------- */

app.use(cors());
app.use(express.json({ limit: '50mb' }));

/* -------------------- DATABASE -------------------- */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Cloud"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });

/* -------------------- MODELS -------------------- */

const User = mongoose.model('User', {
  name: String,
  email: { type: String, unique: true },
  password: String,
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
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isStarred: { type: Boolean, default: false },
  isVault: { type: Boolean, default: false },
  isTrash: { type: Boolean, default: false }
});

const File = mongoose.model('File', {
  fileName: String,
  fileSize: Number,
  s3Path: String,
  parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isStarred: { type: Boolean, default: false },
  isVault: { type: Boolean, default: false },
  isTrash: { type: Boolean, default: false },
  sharedWith: [{
    email: String,
    role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    expiresAt: Date
  }]
});

/* -------------------- AUTH -------------------- */

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* -------------------- FILE UPLOAD -------------------- */

const upload = multer({ dest: '/tmp/' });

app.post('/api/upload/initialize', authenticate, (req, res) => {
  res.json({ uploadId: Date.now().toString() });
});

app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
  const tempFile = path.join('/tmp', `${req.body.uploadId}-${req.body.fileName}`);
  fs.appendFileSync(tempFile, fs.readFileSync(req.file.path));
  fs.unlinkSync(req.file.path);
  res.json({ success: true });
});

app.post('/api/upload/complete', authenticate, async (req, res) => {
  try {
    const { fileName, uploadId, folderId, isVault } = req.body;
    const tempPath = path.join('/tmp', `${uploadId}-${fileName}`);

    if (!fs.existsSync(tempPath)) {
      return res.status(404).json({ error: "Temp file missing" });
    }

    const fileSize = fs.statSync(tempPath).size;
    const user = await User.findById(req.user.id);

    if (user.storageUsed + fileSize > user.storageLimit) {
      fs.unlinkSync(tempPath);
      return res.status(403).json({ error: "Storage exceeded" });
    }

    const s3Path = `${req.user.id}/${Date.now()}-${fileName}`;

    // ✅ SUPABASE-SAFE UPLOAD
    await minioClient.putObject(
      BUCKET_NAME,
      s3Path,
      fs.createReadStream(tempPath),
      fileSize
    );

    const file = await File.create({
      fileName,
      fileSize,
      s3Path,
      parentFolder: folderId || null,
      owner: req.user.id,
      isVault: !!isVault
    });

    await User.findByIdAndUpdate(req.user.id, { $inc: { storageUsed: fileSize } });

    fs.unlinkSync(tempPath);
    res.status(201).json(file);

  } catch (e) {
    console.error("❌ Upload failed:", e);
    res.status(500).json({ error: e.message });
  }
});

/* -------------------- PREVIEW -------------------- */

app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
  const file = await File.findById(req.params.id);
  const url = await minioClient.presignedUrl(
    'GET',
    BUCKET_NAME,
    file.s3Path,
    3600
  );
  res.json({ url });
});

/* -------------------- SERVER -------------------- */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
