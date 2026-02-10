const mongoose = require('mongoose');
const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    path: { type: String, required: true }, // S3 Key
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
    isStarred: { type: Boolean, default: false },
    isVault: { type: Boolean, default: false },
    isTrash: { type: Boolean, default: false },
    sharedWith: [{
        email: String,
        role: { type: String, enum: ['Viewer', 'Editor'], default: 'Viewer' },
        expiresAt: Date
    }],
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("File", fileSchema);