const mongoose = require('mongoose');
const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    path: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
    isStarred: { type: Boolean, default: false },
    isVault: { type: Boolean, default: false },
    isTrash: { type: Boolean, default: false },
    sharedWith: [{ email: String, role: String, expiresAt: Date }]
});
module.exports = mongoose.model("File", fileSchema);