// backend/models/ClientData.js
const mongoose = require('mongoose');

const ClientDataSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    source: { type: String, required: true }, // e.g., 'Referral', 'Showroom', 'Cold Outreach'
    notes: { type: String, trim: true },
    projectValue: { type: String, trim: true }, // Estimated investment like '75L'
    status: { type: String, default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClientData', ClientDataSchema);