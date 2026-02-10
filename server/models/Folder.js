const mongoose = require('mongoose');
const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
    isStarred: { type: Boolean, default: false },
    isVault: { type: Boolean, default: false },
    isTrash: { type: Boolean, default: false }
});
module.exports = mongoose.model("Folder", folderSchema);