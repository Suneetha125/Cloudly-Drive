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

// const app = express();
// const SECRET = "STARTUP_ULTIMATE_SECURE_2026";
// const BUCKET_NAME = 'drive-clone';

// const minioClient = new Minio.Client({
//     endPoint: '127.0.0.1', port: 9000, useSSL: false,
//     accessKey: 'minioadmin', secretKey: 'minioadmin'
// });
// app.use(cors({
//     origin: "*", // During startup phase, "*" is easiest to prevent errors.
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
//     credentials: true
// }));
// app.use(express.json());


// // Deployment DB name
// const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Cloudly_Local';
// mongoose.connect(MONGO_URI)
//   .then(() => console.log("Connected to MongoDB Cloud!"))
//   .catch(err => console.log("Cloud Connection Error:", err));

// // --- SCHEMAS ---
// const User = mongoose.model('User', { 
//     name: String, email: { type: String, unique: true }, password: String, 
//     vaultPIN: { type: String, default: null }, biometricId: { type: String, default: null }
// });
// const Folder = mongoose.model('Folder', { 
//     name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }
// });
// const File = mongoose.model('File', { 
//     fileName: String, fileSize: Number, path: String, 
//     parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
//     isStarred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false },
//     sharedWith: [{ email: String, expiresAt: Date }] 
// });

// const authenticate = (req, res, next) => {
//     const token = req.headers.authorization;
//     if (!token) return res.status(401).json({ error: "No token" });
//     try {
//         const pureToken = token.replace("Bearer ", "");
//         req.user = jwt.verify(pureToken, SECRET);
//         next();
//     } catch (err) { res.status(401).json({ error: "Invalid session" }); }
// };

// // --- AUTH ---
// app.post('/api/auth/register', async (req, res) => {
//     try {
//         const user = new User({ ...req.body, password: await bcrypt.hash(req.body.password, 10) });
//         await user.save(); res.json({ success: true });
//     } catch (e) { res.status(400).json({ error: "Email exists" }); }
// });
// app.post('/api/auth/login', async (req, res) => {
//     const user = await User.findOne({ email: req.body.email.toLowerCase() });
//     if (!user) return res.status(400).json({ error: "User not found. Please Sign Up!" });

//     const isMatch = await bcrypt.compare(req.body.password, user.password);
//     if (!isMatch) return res.status(400).json({ error: "Wrong password." });

//     const token = jwt.sign({ id: user._id, email: user.email }, SECRET);
//     res.json({ token, userName: user.name });
// });

// // --- CONTENT (STRICT OWNER FILTER) ---
// app.get('/api/drive/contents', authenticate, async (req, res) => {
//     const { folderId, tab } = req.query;
//     let filter = { owner: req.user.id }; // PRIVACY: Only my stuff
    
//     if (tab === 'shared') {
//         const shared = await File.find({ "sharedWith.email": req.user.email, $or: [{"sharedWith.expiresAt": {$gt: new Date()}}, {"sharedWith.expiresAt": null}] });
//         return res.json({ folders: [], files: shared });
//     }
    
//     if (folderId && folderId !== "null") filter.parentFolder = folderId;
//     else {
//         filter.parentFolder = null;
//         if (tab === 'starred') filter.isStarred = true;
//         else if (tab === 'vault') filter.isVault = true;
//         else filter.isVault = false;
//     }
//     res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
// });

// app.get('/api/drive/all-folders', authenticate, async (req, res) => {
//     res.json(await Folder.find({ owner: req.user.id }));
// });

// // --- ACTIONS ---
// app.post('/api/drive/folder', authenticate, async (req, res) => {
//     const folder = new Folder({ ...req.body, owner: req.user.id });
//     await folder.save(); res.json(folder);
// });
// app.patch('/api/drive/move', authenticate, async (req, res) => {
//     const Model = req.body.type === 'file' ? File : Folder;
//     let update = { parentFolder: req.body.targetId === 'root' || req.body.targetId === 'vault_root' ? null : req.body.targetId };
//     if (req.body.targetId === 'vault_root') update.isVault = true;
//     else if (req.body.targetId === 'root') update.isVault = false;
//     await Model.findOneAndUpdate({ _id: req.body.itemId, owner: req.user.id }, update);
//     res.json({ success: true });
// });
// app.patch('/api/drive/star/:type/:id', authenticate, async (req, res) => {
//     const Model = req.params.type === 'file' ? File : Folder;
//     const item = await Model.findOne({ _id: req.params.id, owner: req.user.id });
//     item.isStarred = !item.isStarred; await item.save(); res.json({ success: true });
// });
// app.post('/api/drive/share', authenticate, async (req, res) => {
//     try {
//         const { fileId, email, hours } = req.body;
//         const targetEmail = email.toLowerCase();

//         // 1. Validate User Exists (Startup Requirement)
//         const targetUser = await User.findOne({ email: targetEmail });
//         if (!targetUser) return res.status(404).json({ error: "User not registered on Cloudly." });

//         // 2. Prevent sharing with self
//         if (targetEmail === req.user.email) return res.status(400).json({ error: "Cannot share with yourself." });

//         const expiresAt = hours ? new Date(Date.now() + parseInt(hours) * 3600000) : null;
        
//         await File.findOneAndUpdate(
//             { _id: fileId, owner: req.user.id }, 
//             { $push: { sharedWith: { email: targetEmail, expiresAt } } }
//         );
//         res.json({ success: true });
//     } catch (e) { res.status(500).json({ error: "Share failed." }); }
// });

// app.delete('/api/drive/delete/:type/:id', authenticate, async (req, res) => {
//     if (req.params.type === 'file') {
//         const f = await File.findOne({ _id: req.params.id, owner: req.user.id });
//         if (f) { await minioClient.removeObject(BUCKET_NAME, f.path); await File.deleteOne({ _id: f._id }); }
//     } else await Folder.deleteOne({ _id: req.params.id, owner: req.user.id });
//     res.json({ success: true });
// });

// // --- VAULT & BIOMETRICS ---
// app.get('/api/vault/status', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     res.json({ hasPIN: !!user.vaultPIN, hasBiometric: !!user.biometricId });
// });
// app.post('/api/vault/unlock', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ success: true }); }
//     if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ success: true });
//     else res.status(403).json({error: "Wrong PIN"});
// });
// app.post('/api/vault/register-biometric', authenticate, async (req, res) => {
//     await User.findByIdAndUpdate(req.user.id, { biometricId: req.body.credentialId });
//     res.json({ success: true });
// });
// app.post('/api/vault/reset-with-biometric', authenticate, async (req, res) => {
//     const user = await User.findById(req.user.id);
//     if (user.biometricId === req.body.credentialId) {
//         user.vaultPIN = await bcrypt.hash(req.body.newPin, 10); await user.save(); res.json({ success: true });
//     } else res.status(403).json({error: "Biometric Fail"});
// });

// // --- SYSTEM ---
// app.get('/api/drive/preview/:id', authenticate, async (req, res) => {
//     const f = await File.findOne({ _id: req.params.id, owner: req.user.id });
//     if (!f) return res.status(404).send();
//     res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, f.path, 3600) });
// });
// app.get('/api/drive/storage', authenticate, async (req, res) => {
//     const files = await File.find({ owner: req.user.id });
//     res.json({ used: files.reduce((acc, f) => acc + f.fileSize, 0), limit: 53687091200 });
// });

// const upload = multer({ dest: 'temp/' });
// app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
// app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
//     const tPath = path.join(__dirname, 'temp', `${req.body.uploadId}-${req.body.fileName}`);
//     if(!fs.existsSync('temp')) fs.mkdirSync('temp');
//     fs.appendFileSync(tPath, fs.readFileSync(req.file.path));
//     fs.unlinkSync(req.file.path); res.json({ success: true });
// });
// app.post('/api/upload/complete', authenticate, async (req, res) => {
//     const key = `${req.body.uploadId}-${req.body.fileName}`;
//     const tPath = path.join(__dirname, 'temp', key);
//     await minioClient.fPutObject(BUCKET_NAME, key, tPath);
//     const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(tPath).size, path: key, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === true });
//     await file.save(); fs.unlinkSync(tPath); res.json(file);
// });
// app.get('/', (req, res) => {
//     res.send("Cloudly API is Live and Running!");
// });
// app.listen(5000, () => console.log("Startup Engine V10 Running on 5000"));
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
const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY_999";

// 1. SUPABASE S3 CONFIGURATION (Using process.env)
const minioClient = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT || '127.0.0.1',
    port: process.env.S3_ENDPOINT ? 443 : 9000,
    useSSL: !!process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    region: process.env.S3_REGION || 'us-east-1'
});
const BUCKET_NAME = 'drive-clone';

app.use(cors());
app.use(express.json());
app.use('/cdn', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/clouddrive_pro');

// 2. SCHEMAS
const User = mongoose.model('User', { 
    name: String, email: { type: String, unique: true }, password: String, vaultPIN: String 
});
const Folder = mongoose.model('Folder', { 
    name: String, parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false }
});
const File = mongoose.model('File', { 
    fileName: String, fileSize: Number, path: String, 
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, 
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    starred: { type: Boolean, default: false }, isVault: { type: Boolean, default: false }, isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, expiresAt: Date }]
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send("Denied");
    try {
        const pureToken = token.includes("Bearer ") ? token.split(" ")[1] : token;
        req.user = jwt.verify(pureToken, SECRET);
        next();
    } catch (err) { res.status(401).send("Invalid"); }
};

// --- RECURSIVE DELETE ---
const deleteRecursive = async (folderId, permanent = false) => {
    const files = await File.find({ parentFolder: folderId });
    for (let f of files) {
        if (permanent) {
            try { await minioClient.removeObject(BUCKET_NAME, f.path); } catch(e){}
            await File.findByIdAndDelete(f._id);
        } else { await File.findByIdAndUpdate(f._id, { isTrash: true }); }
    }
    const subs = await Folder.find({ parentFolder: folderId });
    for (let s of subs) await deleteRecursive(s._id, permanent);
    if (permanent) await Folder.findByIdAndDelete(folderId);
    else await Folder.findByIdAndUpdate(folderId, { isTrash: true });
};

// --- ROUTES ---
app.get('/api/drive/storage', authenticate, async (req, res) => {
    const files = await File.find({ owner: req.user.id });
    res.json({ used: files.reduce((acc, f) => acc + f.fileSize, 0), limit: 107374182400 });
});

app.get('/api/drive/contents', authenticate, async (req, res) => {
    const { folderId, tab } = req.query;
    let filter = { owner: req.user.id };
    if (tab === 'starred') filter.starred = true;
    else if (tab === 'trash') filter.isTrash = true;
    else if (tab === 'vault') filter.isVault = true;
    else if (tab === 'shared') {
        const user = await User.findById(req.user.id);
        const shared = await File.find({ "sharedWith.email": user.email.toLowerCase() });
        return res.json({ folders: [], files: shared.filter(f => !f.sharedWith.find(a => a.email === user.email.toLowerCase()).expiresAt || new Date() < f.sharedWith.find(a => a.email === user.email.toLowerCase()).expiresAt) });
    } else { filter.isVault = false; filter.isTrash = false; filter.parentFolder = folderId === "null" ? null : folderId; }
    res.json({ folders: await Folder.find(filter), files: await File.find(filter) });
});

app.post('/api/vault/unlock', authenticate, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user.vaultPIN) { user.vaultPIN = await bcrypt.hash(req.body.pin, 10); await user.save(); return res.json({ unlocked: true }); }
    if (await bcrypt.compare(req.body.pin, user.vaultPIN)) res.json({ unlocked: true });
    else res.status(403).send("Wrong");
});

app.patch('/api/files/move', authenticate, async (req, res) => {
    await File.findByIdAndUpdate(req.body.fileId, { parentFolder: req.body.targetId === 'root' ? null : req.body.targetId });
    res.json({ msg: "Moved" });
});

// Upload
const upload = multer({ dest: 'temp/' });
app.post('/api/upload/initialize', authenticate, (req, res) => res.json({ uploadId: Date.now().toString() }));
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), (req, res) => {
    const temp = path.join(__dirname, 'temp', `${req.body.uploadId}-${req.body.fileName}`);
    fs.appendFileSync(temp, fs.readFileSync(req.file.path));
    fs.unlinkSync(req.file.path); res.json({ success: true });
});
app.post('/api/upload/complete', authenticate, async (req, res) => {
    const name = `${req.body.uploadId}-${req.body.fileName}`;
    const dest = path.join(__dirname, 'uploads', name);
    fs.renameSync(path.join(__dirname, 'temp', name), dest);
    await minioClient.fPutObject(BUCKET_NAME, name, dest);
    const file = new File({ fileName: req.body.fileName, fileSize: fs.statSync(dest).size, path: name, parentFolder: req.body.folderId || null, owner: req.user.id, isVault: req.body.isVault === 'true' });
    await file.save(); res.json(file);
});

app.get('/api/files/preview/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    res.json({ url: await minioClient.presignedUrl('GET', BUCKET_NAME, file.path, 3600) });
});

app.delete('/api/files/:id', authenticate, async (req, res) => {
    const file = await File.findById(req.params.id);
    if (file.isTrash) { await minioClient.removeObject(BUCKET_NAME, file.path); await File.findByIdAndDelete(req.params.id); }
    else await File.findByIdAndUpdate(req.params.id, { isTrash: true });
    res.json({ msg: "OK" });
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(400).send("Invalid");
    res.json({ token: jwt.sign({ id: user._id, name: user.name }, SECRET), userName: user.name });
});

app.listen(process.env.PORT || 5000, () => console.log("Server Running"));