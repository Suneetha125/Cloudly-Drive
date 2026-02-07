const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadId: { type: String, required: true }, // For S3/MinIO Multipart
    key: { type: String, required: true },      // Path in storage
    
    // --- CRITICAL FOR RESUME LOGIC (Keep this!) ---
    uploadedParts: [
        {
            PartNumber: Number,
            ETag: String, 
        }
    ],

    // --- OWNERSHIP & PERMISSIONS ---
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    
    // --- NEW: FOLDER INTEGRATION ---
    folder: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Folder", 
        default: null 
    },

    // --- NEW: SHARING (ACL) ---
    sharedWith: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User" 
        }
    ],

    status: { 
        type: String, 
        enum: ["pending", "completed"], 
        default: "pending" 
    },
    
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    isTrashed: { 
        type: Boolean, default: false 
    },
    // Add this field to your File schema
isStarred: { type: Boolean, default: false },
});

module.exports = mongoose.model("File", fileSchema);