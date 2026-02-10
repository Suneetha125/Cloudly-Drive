const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    vaultPIN: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpiry: Date,
    storageUsed: { type: Number, default: 0 } 
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to hash and set PIN
userSchema.methods.setPin = async function(pin) {
    this.vaultPIN = await bcrypt.hash(pin, 10);
};

// Method to compare PIN
userSchema.methods.comparePin = async function(pin) {
    if (!this.vaultPIN) return false;
    return await bcrypt.compare(pin, this.vaultPIN);
};

module.exports = mongoose.model("User", userSchema);