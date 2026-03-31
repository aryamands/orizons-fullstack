// backend/models/ContactLead.js
const mongoose = require('mongoose');

const ContactLeadSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true }, // NEW FIELD
    email: { type: String, required: true, trim: true, lowercase: true },
    projectLocation: { type: String, trim: true },
    projectType: { type: String, trim: true },
    budgetRange: { type: String, trim: true },
    timeline: { type: String, trim: true },
    status: { type: String, default: 'New Inquiry' }, // For the client portal tracking
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ContactLead', ContactLeadSchema);