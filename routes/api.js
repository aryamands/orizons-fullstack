// backend/routes/api.js
const express = require('express');
const router = express.Router();
const ContactLead = require('../models/ContactLead');
const Subscriber = require('../models/Subscriber');
const ClientData = require('../models/ClientData');

// ================= CONTACT FORM ENDPOINT =================
router.post('/contact', async (req, res) => {
    try {
        const newLead = new ContactLead(req.body);
        await newLead.save();
        res.status(201).json({ success: true, message: 'Inquiry received. We will review your details and be in touch shortly.' });
    } catch (error) {
        console.error('[SECURITY] Contact Form Error:', error);
        res.status(500).json({ success: false, error: 'An error occurred. Please try submitting again.' });
    }
});

// ================= ADMIN: MANUAL CLIENT DATA ENTRY =================
router.post('/admin/add-lead', async (req, res) => {
    try {
        // We explicitly pull only these fields from the request (Security Best Practice)
        const { name, phone, email, source, notes, projectValue } = req.body;
        
        const newClientEntry = new ClientData({
            name,
            phone,
            email,
            source,
            notes,
            projectValue
        });

        await newClientEntry.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'Lead synchronized to Orizons Database.' 
        });
    } catch (error) {
        console.error('[DATABASE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database synchronization failed. Please check server logs.' 
        });
    }
});

// ================= NEWSLETTER ENDPOINT =================
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if email already exists to prevent duplicate entries
        const existingSub = await Subscriber.findOne({ email });
        if (existingSub) {
            return res.status(400).json({ success: false, error: 'Email is already registered.' });
        }

        const newSub = new Subscriber({ email });
        await newSub.save();
        res.status(201).json({ success: true, message: 'Subscription confirmed.' });
    } catch (error) {
        console.error('[SECURITY] Subscription Error:', error);
        res.status(500).json({ success: false, error: 'Subscription failed. Please verify your email.' });
    }
});

module.exports = router;