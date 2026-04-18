require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dns = require('dns');
const path = require('path');

const Subscriber = require('./models/Subscriber');

const app = express();
const PORT = 5000;

// ==========================================
// 1. MIDDLEWARE & DATABASE
// ==========================================
app.use(express.json());
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5000'],
    credentials: true
}));

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://admin:Admin%40123@cluster0.hr47sc6.mongodb.net/orizons_v3?appName=Cluster0';

const preferredDnsServers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

if (preferredDnsServers.length > 0) {
    try {
        dns.setServers(preferredDnsServers);
        console.log(`[INFO] DNS resolvers set for MongoDB SRV lookup: ${preferredDnsServers.join(', ')}`);
    } catch (error) {
        console.warn('[WARN] Failed to set custom DNS resolvers:', error.message);
    }
}

mongoose.connect(mongoURI)
    .then(() => console.log('[OK] ORIZONS DATABASE CONNECTED'))
    .catch(err => console.log('[ERROR] DATABASE ERROR:', err.message));

// ==========================================
// 1.5 MONGOOSE DATA MODELS
// ==========================================
const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    type: String,
    budget: String,
    notes: String,
    submittedAt: { type: Date, default: Date.now }
});

const Inquiry = mongoose.model('Inquiry', inquirySchema, 'clientdatas');

app.get('/api/check-db', async (req, res) => {
    const allLeads = await Inquiry.find({});
    res.json(allLeads);
});

// ==========================================
// 2. SESSION ENGINE
// ==========================================
app.use(session({
    name: 'orizons.sid',
    secret: process.env.SESSION_SECRET || 'arch_secret_orizons_2026',
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

const noStore = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};

// ==========================================
// 3. SECURITY GATEKEEPER
// ==========================================
const protectClientPortal = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    return res.redirect('/admin/admin.html');
};

app.use('/admin', noStore);
app.use('/client-portal', protectClientPortal);
app.use('/client-portal', noStore);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// 4. API: ADMIN LOGIN
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const storedUsername = 'Orizons';
    const storedHash = '$2b$10$qYTkmTzn3cIndtFogJ7RiOO3tToULUns2XMvIQ0c2R3n/UFBLsTsu';

    try {
        if (username === storedUsername) {
            const isMatch = await bcrypt.compare(password, storedHash);
            if (isMatch) {
                return req.session.regenerate((regenerateErr) => {
                    if (regenerateErr) {
                        return res.status(500).json({ success: false, error: 'SESSION_INIT_FAILED' });
                    }

                    req.session.isAuthenticated = true;
                    return req.session.save(() => {
                        res.json({ success: true });
                    });
                });
            }
        }

        return res.status(401).json({ success: false, error: 'AUTH_FAILED' });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
});

// ==========================================
// 4.5 API: SECURE LOGOUT
// ==========================================
app.post('/api/admin/logout', (req, res) => {
    if (!req.session) {
        res.clearCookie('orizons.sid', { path: '/' });
        return res.json({ success: true, message: 'VAULT_LOCKED' });
    }

    return req.session.destroy((err) => {
        if (err) {
            console.error('[ERROR] Logout Error:', err);
            return res.status(500).json({ success: false, message: 'LOGOUT_FAILED' });
        }

        res.clearCookie('orizons.sid', { path: '/' });
        console.log('[OK] Vault Locked. Session Destroyed.');
        return res.json({ success: true, message: 'VAULT_LOCKED' });
    });
});

// ==========================================
// 4.6 FRONTEND AUTH CHECKER
// ==========================================
app.get('/api/check-auth', noStore, (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        return res.status(200).json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false });
});

// ==========================================
// 5. DATA INTAKE PIPELINES (SAVING TO ATLAS)
// ==========================================

// A. INQUIRY PIPELINE
app.post('/api/contact', async (req, res) => {
    console.log('\n=================================');
    console.log('[ALERT] INCOMING REQUEST TO /api/contact');
    console.log('[DATA] RAW DATA RECEIVED:', req.body);
    console.log('=================================\n');

    try {
        const newInquiry = new Inquiry(req.body);
        await newInquiry.save();

        console.log('[OK] SUCCESS: Lead Saved to Atlas ->', req.body.name);
        return res.json({ success: true, message: 'INQUIRY_SECURED' });
    } catch (err) {
        console.error('[ERROR] MONGOOSE REJECTED THE DATA!');
        console.error('Exact Error:', err.message);
        return res.status(500).json({ success: false, error: 'DATABASE_WRITE_ERROR', details: err.message });
    }
});

// B. NEWSLETTER PIPELINE
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;

        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ message: 'Email is already subscribed.' });
        }

        const newSubscriber = new Subscriber({ email });
        await newSubscriber.save();

        console.log('[OK] New Subscriber Added:', email);
        return res.status(201).json({ message: 'Successfully subscribed!' });
    } catch (error) {
        console.error('Newsletter Subscription Error:', error);
        return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// ==========================================
// 6. SERVER LAUNCH
// ==========================================
app.listen(PORT, () => {
    console.log(`[STARTED] ORIZONS SECURE ENGINE ACTIVE: http://localhost:${PORT}`);
});
