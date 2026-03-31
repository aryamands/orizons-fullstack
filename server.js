require('dotenv').config(); // This loads the variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 5000;

// ==========================================
// 1. MIDDLEWARE & DATABASE
// ==========================================
app.use(express.json());
app.use(cors({
    origin: 'http://127.0.0.1:5500', 
    credentials: true
}));

const mongoURI = 'mongodb+srv://admin:Admin%40123@cluster0.hr47sc6.mongodb.net/orizons_v3?appName=Cluster0';

mongoose.connect(mongoURI)
    .then(() => console.log("✔ ORIZONS DATABASE CONNECTED"))
    .catch(err => console.log("✘ DATABASE ERROR:", err.message));

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
// AND add this check route right below it
app.get('/api/check-db', async (req, res) => {
    const allLeads = await Inquiry.find({});
    res.json(allLeads);
});
const subscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    subscribedAt: { type: Date, default: Date.now }
});
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// ==========================================
// 2. SESSION ENGINE
// ==========================================
app.use(session({
    secret: 'arch_secret_orizons_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: mongoURI,
        collectionName: 'sessions' 
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 2, // 2 Hours
        secure: false, // Set to true when deploying to HTTPS
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// ==========================================
// 3. SECURITY GATEKEEPER
// ==========================================
const protectClientPortal = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/admin/admin.html');
};

// Protect the client portal route
app.use('/client-portal', protectClientPortal);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// 4. API: ADMIN LOGIN
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const storedUsername = "Orizons";
    const storedHash = "$2b$10$qYTkmTzn3cIndtFogJ7RiOO3tToULUns2XMvIQ0c2R3n/UFBLsTsu"; 

    try {
        if (username === storedUsername) {
            const isMatch = await bcrypt.compare(password, storedHash);
            if (isMatch) {
                req.session.isAuthenticated = true;
                return req.session.save(() => {
                    res.json({ success: true });
                });
            }
        }
        res.status(401).json({ success: false, error: "AUTH_FAILED" });
    } catch (err) {
        res.status(500).json({ error: "SERVER_ERROR" });
    }
});

// ==========================================
// 4.5 API: SECURE LOGOUT (THE NEW ADDITION)
// ==========================================
app.post('/api/admin/logout', (req, res) => {
    // 1. Physically destroy the session in MongoDB
    req.session.destroy((err) => {
        if (err) {
            console.error("✘ Logout Error:", err);
            return res.status(500).json({ success: false, message: "LOGOUT_FAILED" });
        }
        
        // 2. Clear the cookie from the user's browser
        res.clearCookie('connect.sid', { path: '/' }); 
        
        console.log("✔ Vault Locked. Session Destroyed.");
        res.json({ success: true, message: "VAULT_LOCKED" });
    });
});

// ==========================================
// 4.6 FRONTEND AUTH CHECKER (For Live Server Testing)
// ==========================================
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.status(200).json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// ==========================================
// 5. DATA INTAKE PIPELINES (SAVING TO ATLAS)
// ==========================================
// A. INQUIRY PIPELINE (WITH X-RAY LOGGING)
app.post('/api/contact', async (req, res) => {
    console.log("\n=================================");
    console.log("🚨 INCOMING REQUEST TO /api/contact");
    console.log("📦 RAW DATA RECEIVED:", req.body);
    console.log("=================================\n");

    try {
        const newInquiry = new Inquiry(req.body);
        await newInquiry.save();
        
        console.log("✔ SUCCESS: Lead Saved to Atlas ->", req.body.name);
        res.json({ success: true, message: "INQUIRY_SECURED" });
    } catch (err) {
        console.error("✘ MONGOOSE REJECTED THE DATA!");
        console.error("Exact Error:", err.message);
        res.status(500).json({ success: false, error: "DATABASE_WRITE_ERROR", details: err.message });
    }
});

app.post('/api/subscribe', async (req, res) => {
    try {
        const newSubscriber = new Subscriber({ email: req.body.email });
        await newSubscriber.save();
        console.log("✔ New Subscriber Added:", req.body.email);
        res.json({ success: true, message: "SUBSCRIBED" });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, error: "DUPLICATE_EMAIL" });
        }
        res.status(500).json({ success: false, error: "SERVER_ERROR" });
    }
});

// ==========================================
// 6. SERVER LAUNCH
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 ORIZONS SECURE ENGINE ACTIVE: http://localhost:${PORT}`);
});