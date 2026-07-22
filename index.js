// ========================================
// BEAR FIGHTER TRADING - Complete Server
// By Vaibhav
// ========================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const axios = require('axios');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.static('public', { maxAge: '0', etag: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🐻 BEAR FIGHTER TRADING - Starting...');

// ========================================
// ROUTES - ADMIN & DASHBOARD
// ========================================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get public settings (disclaimer text)
app.get('/api/settings', (req, res) => {
    const settings = loadSettings();
    res.json({
        success: true,
        disclaimerText: settings.disclaimerText,
        disclaimerBgColor: settings.disclaimerBgColor || '#ffeb3b',
        disclaimerTextColor: settings.disclaimerTextColor || '#000000',
        disclaimerSpeed: settings.disclaimerSpeed || 25,
        disclaimerFontSize: settings.disclaimerFontSize || 14,
        upstoxApiKey: settings.upstoxApiKey || '',
        upstoxAccessToken: settings.upstoxAccessToken || '',
        telegramBotToken: settings.telegramBotToken || '',
        telegramChatId: settings.telegramChatId || ''
    });
});

// Admin: update settings
app.put('/api/admin/settings', checkAdmin, (req, res) => {
    try {
        const { disclaimerText, disclaimerBgColor, disclaimerTextColor, disclaimerSpeed, disclaimerFontSize, upstoxApiKey, upstoxAccessToken, telegramBotToken, telegramChatId } = req.body;
        const settings = loadSettings();
        if (disclaimerText !== undefined) settings.disclaimerText = disclaimerText;
        if (disclaimerBgColor !== undefined) settings.disclaimerBgColor = disclaimerBgColor;
        if (disclaimerTextColor !== undefined) settings.disclaimerTextColor = disclaimerTextColor;
        if (disclaimerSpeed !== undefined) settings.disclaimerSpeed = parseInt(disclaimerSpeed) || 25;
        if (disclaimerFontSize !== undefined) settings.disclaimerFontSize = parseInt(disclaimerFontSize) || 14;
        if (upstoxApiKey !== undefined) settings.upstoxApiKey = upstoxApiKey;
        if (upstoxAccessToken !== undefined) settings.upstoxAccessToken = upstoxAccessToken;
        if (telegramBotToken !== undefined) settings.telegramBotToken = telegramBotToken;
        if (telegramChatId !== undefined) settings.telegramChatId = telegramChatId;
        saveSettings(settings);
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Toggle maintenance mode
app.post('/api/admin/maintenance', checkAdmin, (req, res) => {
    try {
        const { enabled, message } = req.body;
        const settings = loadSettings();
        settings.maintenanceMode = enabled;
        if (message !== undefined) settings.maintenanceMessage = message;
        saveSettings(settings);
        logActivity('maintenance_' + (enabled ? 'on' : 'off'), message || '');
        res.json({ success: true, maintenance: settings.maintenanceMode });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Get maintenance status (public)
app.get('/api/maintenance', (req, res) => {
    const settings = loadSettings();
    res.json({ maintenance: settings.maintenanceMode, message: settings.maintenanceMessage });
});

// ========================================
// USERS DATABASE (JSON file)
// ========================================
const USERS_FILE = path.join(__dirname, 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const STOCKTIPS_FILE = path.join(__dirname, 'stocktips.json');
const ACTIVITYLOG_FILE = path.join(__dirname, 'activitylog.json');
const LOGINHISTORY_FILE = path.join(__dirname, 'loginhistory.json');
const SCHEDULED_MSGS_FILE = path.join(__dirname, 'scheduledmsgs.json');

// Initialize users file if doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    console.log('📁 Created users.json');
}

// Initialize settings file if doesn't exist
const DEFAULT_SETTINGS = {
    disclaimerText: '⚠️ I AM NOT SEBI REGISTERED - This is for educational purposes only. Not a financial advisor.',
    disclaimerBgColor: '#ffeb3b',
    disclaimerTextColor: '#000000',
    disclaimerSpeed: 25,
    disclaimerFontSize: 14,
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon!',
    adminPassword: 'bearfighter@admin',
    upstoxApiKey: '',
    upstoxAccessToken: '',
    telegramBotToken: '',
    telegramChatId: ''
};
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    console.log('📁 Created settings.json');
}

// Initialize stocktips file
if (!fs.existsSync(STOCKTIPS_FILE)) {
    fs.writeFileSync(STOCKTIPS_FILE, JSON.stringify({ tips: [] }, null, 2));
    console.log('📁 Created stocktips.json');
}

// Initialize activity log file
if (!fs.existsSync(ACTIVITYLOG_FILE)) {
    fs.writeFileSync(ACTIVITYLOG_FILE, JSON.stringify({ activities: [] }, null, 2));
    console.log('📁 Created activitylog.json');
}

// Initialize login history file
if (!fs.existsSync(LOGINHISTORY_FILE)) {
    fs.writeFileSync(LOGINHISTORY_FILE, JSON.stringify({ logins: [] }, null, 2));
    console.log('📁 Created loginhistory.json');
}

// Initialize scheduled messages file
if (!fs.existsSync(SCHEDULED_MSGS_FILE)) {
    fs.writeFileSync(SCHEDULED_MSGS_FILE, JSON.stringify({ messages: [] }, null, 2));
    console.log('📁 Created scheduledmsgs.json');
}

function loadActivityLog() {
    try {
        return JSON.parse(fs.readFileSync(ACTIVITYLOG_FILE, 'utf8'));
    } catch (e) {
        return { activities: [] };
    }
}

function saveActivityLog(data) {
    fs.writeFileSync(ACTIVITYLOG_FILE, JSON.stringify(data, null, 2));
}

function logActivity(action, details) {
    const log = loadActivityLog();
    log.activities.unshift({
        id: 'act_' + Date.now(),
        action,
        details,
        timestamp: new Date().toISOString()
    });
    if (log.activities.length > 100) log.activities = log.activities.slice(0, 100);
    saveActivityLog(log);
}

// Login History
function loadLoginHistory() {
    try { return JSON.parse(fs.readFileSync(LOGINHISTORY_FILE, 'utf8')); } catch (e) { return { logins: [] }; }
}
function saveLoginHistory(data) { fs.writeFileSync(LOGINHISTORY_FILE, JSON.stringify(data, null, 2)); }
function logLogin(username, success) {
    const log = loadLoginHistory();
    log.logins.unshift({ id: 'login_' + Date.now(), username, success, timestamp: new Date().toISOString() });
    if (log.logins.length > 50) log.logins = log.logins.slice(0, 50);
    saveLoginHistory(log);
}

// Scheduled Messages
function loadScheduledMsgs() {
    try { return JSON.parse(fs.readFileSync(SCHEDULED_MSGS_FILE, 'utf8')); } catch (e) { return { messages: [] }; }
}
function saveScheduledMsgs(data) { fs.writeFileSync(SCHEDULED_MSGS_FILE, JSON.stringify(data, null, 2)); }

function loadStockTips() {
    try {
        return JSON.parse(fs.readFileSync(STOCKTIPS_FILE, 'utf8'));
    } catch (e) {
        return { tips: [] };
    }
}

function saveStockTips(data) {
    fs.writeFileSync(STOCKTIPS_FILE, JSON.stringify(data, null, 2));
}

function loadUsers() {
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        if (!data.users || data.users.length === 0) {
            data.users = [createDefaultAdmin()];
            saveUsers(data);
        }
        return data;
    } catch (e) {
        console.log('📁 Creating default users.json with admin user...');
        const defaultData = { users: [createDefaultAdmin()] };
        saveUsers(defaultData);
        return defaultData;
    }
}

function createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    return {
        id: 'usr_admin_' + Date.now(),
        username: 'admin',
        fullName: 'Vaibhav',
        name: 'Vaibhav',
        email: 'admin@bearfighter.com',
        phone: '0000000000',
        category: 'diamond',
        status: 'active',
        active: true,
        approved: true,
        amount: 0,
        paymentAmount: 0,
        paymentMethod: 'UPI',
        paymentDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        password: bcrypt.hashSync(loadSettings().adminPassword || 'bearfighter@admin', 10),
        isOwner: true,
        message: '',
        msgColor: '#22c55e'
    };
}

function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function loadSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(data) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ========================================
// HELPER FUNCTIONS
// ========================================
function generateUserId() {
    return 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function isSubscriptionActive(user) {
    if (!user.approved) return false;
    return new Date(user.subscriptionExpiry) > new Date();
}

function getDaysUntilExpiry(user) {
    if (!user.approved) return 0;
    const diff = new Date(user.subscriptionExpiry) - new Date();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ========================================
// TELEGRAM BOT INTEGRATION
// ========================================
const TELEGRAM_BOT_TOKEN = (loadSettings().telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '');
const TELEGRAM_CHAT_ID = (loadSettings().telegramChatId || process.env.TELEGRAM_CHAT_ID || '');

async function sendToTelegram(message) {
    const settings = loadSettings();
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID || '';
    if (!botToken || !chatId) {
        console.log('⚠️ Telegram not configured. Set in admin panel or .env');
        return false;
    }
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram message sent');
        return true;
    } catch (error) {
        console.error('❌ Telegram error:', error.response?.data?.description || error.message);
        return false;
    }
}

async function sendStockTipToTelegram(tip) {
    const isBuy = tip.action === 'BUY';
    const emoji = isBuy ? '🟢' : '🔴';
    let msg = `<b>${emoji} ${tip.action} — ${tip.symbol}</b>\n\n`;
    if (tip.entry) msg += `💰 <b>Entry:</b> ${tip.entry}\n`;
    if (tip.target) msg += `🎯 <b>Target:</b> ${tip.target}\n`;
    if (tip.sl) msg += `🛑 <b>SL:</b> ${tip.sl}\n`;
    if (tip.note) msg += `📝 ${tip.note}\n`;
    msg += `\n<i>By Vaibhav | BearFighter Trading</i>`;
    return await sendToTelegram(msg);
}

async function sendTipStatusToTelegram(tip, status) {
    const emoji = status === 'target_done' ? '✅' : '❌';
    const label = status === 'target_done' ? 'TARGET DONE' : 'SL HIT';
    let msg = `<b>${emoji} ${label} — ${tip.symbol}</b>\n\n`;
    msg += `Action: ${tip.action}\n`;
    if (tip.entry) msg += `Entry: ${tip.entry}\n`;
    if (tip.target) msg += `Target: ${tip.target}\n`;
    if (tip.sl) msg += `SL: ${tip.sl}\n`;
    msg += `\n<i>By Vaibhav | BearFighter Trading</i>`;
    return await sendToTelegram(msg);
}

// Send message to a specific Telegram chat ID
async function sendToTelegramChat(chatId, message) {
    const settings = loadSettings();
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
    if (!botToken || !chatId) return false;
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`✅ Telegram sent to chat: ${chatId}`);
        return true;
    } catch (error) {
        console.error(`❌ Telegram error for chat ${chatId}:`, error.response?.data?.description || error.message);
        return false;
    }
}

// Send stock tip to a specific user's Telegram
async function sendStockTipToUser(tip, user) {
    if (!user.telegramChatId) return false;
    const isBuy = tip.action === 'BUY';
    const emoji = isBuy ? '🟢' : '🔴';
    let msg = `<b>${emoji} ${tip.action} — ${tip.symbol}</b>\n\n`;
    if (tip.entry) msg += `💰 <b>Entry:</b> ${tip.entry}\n`;
    if (tip.target) msg += `🎯 <b>Target:</b> ${tip.target}\n`;
    if (tip.sl) msg += `🛑 <b>SL:</b> ${tip.sl}\n`;
    if (tip.note) msg += `📝 ${tip.note}\n`;
    msg += `\n<i>By Vaibhav | BearFighter Trading</i>`;
    return await sendToTelegramChat(user.telegramChatId, msg);
}

// Send broadcast message to a specific user's Telegram
async function sendBroadcastToUser(message, user) {
    if (!user.telegramChatId) return false;
    let msg = `<b>📢 Broadcast Message</b>\n\n`;
    msg += `${message}\n`;
    msg += `\n<i>By Vaibhav | BearFighter Trading</i>`;
    return await sendToTelegramChat(user.telegramChatId, msg);
}

// Generate WhatsApp click-to-chat link
function generateWhatsAppLink(phoneNumber, message) {
    if (!phoneNumber) return null;
    // Remove +, spaces, dashes - keep only digits with country code
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${clean}?text=${encoded}`;
}

// Generate WhatsApp message for stock tip
function getStockTipWhatsAppMsg(tip) {
    const isBuy = tip.action === 'BUY';
    const emoji = isBuy ? '🟢' : '🔴';
    let msg = `${emoji} ${tip.action} — ${tip.symbol}\n\n`;
    if (tip.entry) msg += `Entry: ${tip.entry}\n`;
    if (tip.target) msg += `Target: ${tip.target}\n`;
    if (tip.sl) msg += `SL: ${tip.sl}\n`;
    if (tip.note) msg += `📝 ${tip.note}\n`;
    msg += `\nBy Vaibhav | BearFighter Trading`;
    return msg;
}

// Generate WhatsApp message for broadcast
function getBroadcastWhatsAppMsg(message) {
    return `📢 Broadcast Message\n\n${message}\n\nBy Vaibhav | BearFighter Trading`;
}

// Middleware: Check if user is logged in and active
function checkUserAuth(req, res, next) {
    // Check maintenance mode first
    const settings = loadSettings();
    if (settings.maintenanceMode) {
        return res.status(503).json({ 
            error: 'Maintenance mode active', 
            maintenance: true,
            message: settings.maintenanceMessage 
        });
    }

    const userId = req.headers['user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    if (!isSubscriptionActive(user)) {
        return res.status(403).json({ error: 'Subscription expired', blocked: true });
    }
    
    req.user = user;
    next();
}

// Middleware: Check maintenance mode (blocks user routes, allows admin)
function checkMaintenance(req, res, next) {
    const settings = loadSettings();
    if (settings.maintenanceMode) {
        const adminKey = req.headers['admin-key'];
        if (adminKey !== ADMIN_PASSWORD) {
            return res.status(503).json({ 
                error: 'Maintenance mode active', 
                maintenance: true,
                message: settings.maintenanceMessage || 'We are currently performing scheduled maintenance.'
            });
        }
    }
    next();
}

// ========================================
// LOGIN ROUTE
// ========================================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, location } = req.body;
        
        console.log('🔐 Login attempt:', username);
        
        // Check maintenance mode
        const settings = loadSettings();
        if (settings.maintenanceMode) {
            return res.json({ success: false, maintenance: true, message: settings.maintenanceMessage || 'System under maintenance. Please try again later.' });
        }
        
        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }
        
        const data = loadUsers();
        
        if (!data.users || data.users.length === 0) {
            console.log('❌ No users in database');
            return res.json({ success: false, message: 'No users exist. Run: node create-user.js' });
        }
        
        const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            console.log('❌ User not found:', username);
            logLogin(username, false);
            console.log('Available users:', data.users.map(u => u.username).join(', '));
            return res.json({ success: false, message: 'User not found. Run create-user.js first.' });
        }
        
        if (!user.approved) {
            return res.json({ success: false, message: 'Account not approved. Contact admin.' });
        }
        
        // Check subscription
        if (!isSubscriptionActive(user)) {
            return res.json({ success: false, message: 'Subscription expired. Contact admin.', blocked: true });
        }
        
        // Simple password check
        if (user.password !== password) {
            console.log('❌ Wrong password for:', username);
            logLogin(username, false);
            return res.json({ success: false, message: 'Invalid password' });
        }
        
        console.log('✅ Login successful:', username);
        logLogin(username, true);
        
        // Update last login and location
        user.lastLogin = new Date().toISOString();
        if (location) {
            user.lastLocation = location;
            user.lastLocationTime = new Date().toISOString();
        }
        saveUsers(data);
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscriptionExpiry: user.subscriptionExpiry,
                daysLeft: getDaysUntilExpiry(user)
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    res.json({ success: true });
});

// Check session
app.get('/api/me', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ loggedIn: false });
    
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user || !isSubscriptionActive(user)) {
        return res.json({ loggedIn: false });
    }
    
    res.json({ 
        loggedIn: true, 
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            subscriptionExpiry: user.subscriptionExpiry,
            daysLeft: getDaysUntilExpiry(user),
            message: user.message || '',
            msgColor: user.msgColor || '#ff6b35',
            highlight: user.highlight || false
        }
    });
});

// ========================================
// ADMIN ROUTES
// ========================================
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bearfighter@admin';
// Load saved password from settings
const _savedSettings = loadSettings();
if (_savedSettings.adminPassword) ADMIN_PASSWORD = _savedSettings.adminPassword;

function checkAdmin(req, res, next) {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Get all users
app.get('/api/admin/users', checkAdmin, (req, res) => {
    const data = loadUsers();
    const users = data.users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        category: u.category || 'Silver',
        paymentAmount: u.paymentAmount,
        paymentId: u.paymentId,
        paymentMethod: u.paymentMethod,
        telegramChatId: u.telegramChatId || '',
        whatsappNumber: u.whatsappNumber || '',
        approved: u.approved,
        subscriptionExpiry: u.subscriptionExpiry,
        daysLeft: getDaysUntilExpiry(u),
        active: isSubscriptionActive(u),
        lastLogin: u.lastLogin,
        lastLocation: u.lastLocation || null,
        lastLocationTime: u.lastLocationTime || null,
        createdAt: u.createdAt,
        message: u.message || '',
        msgColor: u.msgColor || '#ff6b35',
        highlight: u.highlight || false
    }));
    res.json({ success: true, users });
});

// Approve new user
app.post('/api/admin/approve', checkAdmin, (req, res) => {
    try {
        const { username, email, password, days, fullName, paymentAmount, paymentId, paymentMethod, category, telegramChatId, whatsappNumber } = req.body;
        
        if (!username || !email || !password || !fullName) {
            return res.json({ success: false, message: 'Username, email, password, and full name required' });
        }
        
        if (!paymentAmount || !paymentId || !paymentMethod) {
            return res.json({ success: false, message: 'Payment details required' });
        }
        
        const data = loadUsers();
        
        if (data.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            return res.json({ success: false, message: 'Username already exists' });
        }
        
        const subscriptionDays = parseInt(days) || 30;
        const newUser = {
            id: generateUserId(),
            username: username,
            email: email,
            password: password,
            fullName: fullName,
            approved: true,
            category: category || 'Silver',
            paymentAmount: parseFloat(paymentAmount),
            paymentId: paymentId,
            paymentMethod: paymentMethod,
            telegramChatId: telegramChatId || '',
            whatsappNumber: whatsappNumber || '',
            subscriptionExpiry: new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString(),
            lastLogin: null,
            createdAt: new Date().toISOString()
        };
        
        data.users.push(newUser);
        saveUsers(data);
        
        console.log(`✅ User approved: ${username} (${fullName}) - Payment: ₹${paymentAmount} (${paymentId})`);
        logActivity('user_created', `${fullName} (${username}) — ₹${paymentAmount} — ${category || 'Silver'} — ${subscriptionDays} days`);
        
        res.json({ success: true, message: `User ${fullName} created for ${subscriptionDays} days! Payment: ₹${paymentAmount}`, user: newUser });
    } catch (error) {
        res.json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Block user
app.post('/api/admin/block', checkAdmin, (req, res) => {
    try {
        const { username } = req.body;
        const data = loadUsers();
        const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        user.subscriptionExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        saveUsers(data);
        logActivity('user_blocked', `${username}`);
        
        res.json({ success: true, message: `User ${username} blocked.` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Renew user
app.post('/api/admin/renew', checkAdmin, (req, res) => {
    try {
        const { username, days } = req.body;
        const extendDays = parseInt(days) || 30;
        const data = loadUsers();
        const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const currentExpiry = new Date(user.subscriptionExpiry);
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        user.subscriptionExpiry = new Date(baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000).toISOString();
        user.approved = true;
        saveUsers(data);
        logActivity('user_renewed', `${username} — ${extendDays} days extended`);
        
        res.json({ success: true, message: `User ${username} extended by ${extendDays} days.` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Delete user
app.delete('/api/admin/user/:username', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const initialLength = data.users.length;
        data.users = data.users.filter(u => u.username.toLowerCase() !== req.params.username.toLowerCase());
        
        if (data.users.length === initialLength) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        saveUsers(data);
        logActivity('user_deleted', `${req.params.username}`);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Edit user (update payment info and full name)
app.put('/api/admin/user/:username', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const userIndex = data.users.findIndex(u => u.username.toLowerCase() === req.params.username.toLowerCase());
        
        if (userIndex === -1) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        const { fullName, paymentAmount, paymentId, paymentMethod, message, highlight, msgColor, category, telegramChatId, whatsappNumber } = req.body;
        
        if (fullName !== undefined) data.users[userIndex].fullName = fullName;
        if (paymentAmount !== undefined) data.users[userIndex].paymentAmount = paymentAmount;
        if (paymentId !== undefined) data.users[userIndex].paymentId = paymentId;
        if (paymentMethod !== undefined) data.users[userIndex].paymentMethod = paymentMethod;
        if (message !== undefined) data.users[userIndex].message = message;
        if (highlight !== undefined) data.users[userIndex].highlight = highlight;
        if (msgColor !== undefined) data.users[userIndex].msgColor = msgColor;
        if (category !== undefined) data.users[userIndex].category = category;
        if (telegramChatId !== undefined) data.users[userIndex].telegramChatId = telegramChatId;
        if (whatsappNumber !== undefined) data.users[userIndex].whatsappNumber = whatsappNumber;
        
        saveUsers(data);
        logActivity('user_edited', `${req.params.username}`);
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Broadcast message to multiple users
app.post('/api/admin/broadcast', checkAdmin, async (req, res) => {
    try {
        const { usernames, message, msgColor, sendTelegram, sendWhatsApp } = req.body;
        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return res.json({ success: false, message: 'Select at least one user' });
        }
        if (!message || message.trim() === '') {
            return res.json({ success: false, message: 'Message cannot be empty' });
        }
        const data = loadUsers();
        let count = 0;
        let telegramCount = 0;
        data.users.forEach(u => {
            if (usernames.includes(u.username)) {
                u.message = message.trim();
                u.msgColor = msgColor || '#ff6b35';
                count++;
            }
        });
        saveUsers(data);

        // Send to selected users' Telegram (only if sendTelegram is true)
        if (sendTelegram) {
            for (const u of data.users) {
                if (usernames.includes(u.username) && u.telegramChatId) {
                    await sendBroadcastToUser(message.trim(), u);
                    telegramCount++;
                }
            }
        }

        logActivity('broadcast_sent', `Message sent to ${count} user(s) — Telegram: ${telegramCount} users`);

        // Generate WhatsApp links for selected users (only if sendWhatsApp is true)
        const whatsappLinks = [];
        if (sendWhatsApp) {
            for (const u of data.users) {
                if (usernames.includes(u.username) && u.whatsappNumber) {
                    const link = generateWhatsAppLink(u.whatsappNumber, getBroadcastWhatsAppMsg(message.trim()));
                    if (link) whatsappLinks.push({ username: u.username, link });
                }
            }
        }

        res.json({ success: true, message: `Message sent to ${count} user(s). Telegram: ${telegramCount}, WhatsApp: ${whatsappLinks.length}`, whatsappLinks });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Clear message for multiple users
app.post('/api/admin/clear-messages', checkAdmin, (req, res) => {
    try {
        const { usernames } = req.body;
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (usernames.includes(u.username)) {
                u.message = '';
                u.msgColor = '#ff6b35';
                count++;
            }
        });
        saveUsers(data);
        res.json({ success: true, message: `Messages cleared for ${count} user(s)` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Clear ALL messages for ALL users
app.post('/api/admin/clear-all-messages', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (u.message && u.message.trim() !== '') {
                u.message = '';
                u.msgColor = '#ff6b35';
                count++;
            }
        });
        saveUsers(data);
        res.json({ success: true, message: `All messages cleared for ${count} user(s)` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// ========================================
// STOCK TIPS (Admin posts, users see)
// ========================================

// Get active stock tips (public - for logged in users)
app.get('/api/stocktips', checkUserAuth, (req, res) => {
    const data = loadStockTips();
    const activeTips = data.tips.filter(t => t.active);
    res.json(activeTips);
});

// Admin: Get all stock tips
app.get('/api/admin/stocktips', checkAdmin, (req, res) => {
    const data = loadStockTips();
    res.json({ success: true, tips: data.tips });
});

// Admin: Dashboard overview stats
app.get('/api/admin/dashboard', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const tips = loadStockTips();
        const log = loadActivityLog();
        const now = new Date();

        // Revenue
        let totalRevenue = 0;
        let monthlyRevenue = 0;
        data.users.forEach(u => {
            const amt = parseFloat(u.paymentAmount) || 0;
            totalRevenue += amt;
            if (u.createdAt) {
                const created = new Date(u.createdAt);
                if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
                    monthlyRevenue += amt;
                }
            }
        });

        // Pending payments (users with paymentAmount = 0)
        const pendingPayments = data.users.filter(u => !u.paymentAmount || u.paymentAmount === 0);

        // Category breakdown
        const categories = { Silver: 0, Gold: 0, Diamond: 0, Premium: 0 };
        data.users.forEach(u => {
            const cat = u.category || 'Silver';
            if (categories[cat] !== undefined) categories[cat]++;
        });

        // Active / Expired / Expiring Soon (7 days)
        let activeCount = 0;
        let expiredCount = 0;
        let expiringSoon = [];
        data.users.forEach(u => {
            if (isSubscriptionActive(u)) {
                activeCount++;
                const days = getDaysUntilExpiry(u);
                if (days <= 7) expiringSoon.push({ username: u.username, fullName: u.fullName, daysLeft: days });
            } else {
                expiredCount++;
            }
        });

        // Stock tips stats
        const activeTips = tips.tips.filter(t => t.active).length;
        const totalTips = tips.tips.length;

        res.json({
            success: true,
            stats: {
                totalUsers: data.users.length,
                activeUsers: activeCount,
                expiredUsers: expiredCount,
                expiringSoon: expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft),
                totalRevenue,
                monthlyRevenue,
                pendingPayments: pendingPayments.length,
                categories,
                stockTips: { total: totalTips, active: activeTips }
            },
            recentActivity: log.activities.slice(0, 15)
        });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Add stock tip
app.post('/api/admin/stocktips', checkAdmin, async (req, res) => {
    try {
        const { symbol, action, entry, target, sl, note, sendTelegram } = req.body;
        if (!symbol || !action) {
            return res.json({ success: false, message: 'Symbol and action required' });
        }
        const data = loadStockTips();
        const tip = {
            id: 'tip_' + Date.now(),
            symbol: symbol.toUpperCase(),
            action: action.toUpperCase(),
            entry: entry || '',
            target: target || '',
            sl: sl || '',
            note: note || '',
            active: true,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        data.tips.unshift(tip);
        saveStockTips(data);

        // Send to Telegram if requested
        let telegramCount = 0;
        if (sendTelegram) {
            // Send to admin's Telegram (global)
            await sendStockTipToTelegram(tip);
            // Send to all active users' individual Telegram
            const usersData = loadUsers();
            for (const u of usersData.users) {
                if (isSubscriptionActive(u) && u.telegramChatId) {
                    await sendStockTipToUser(tip, u);
                    telegramCount++;
                }
            }
        }

        logActivity('stocktip_added', `${tip.action} ${tip.symbol} — Entry: ${tip.entry || 'N/A'} — Telegram: ${telegramCount} users`);

        // Generate WhatsApp links for all active users with WhatsApp numbers
        const whatsappLinks = [];
        const allUsers = loadUsers();
        for (const u of allUsers.users) {
            if (isSubscriptionActive(u) && u.whatsappNumber) {
                const link = generateWhatsAppLink(u.whatsappNumber, getStockTipWhatsAppMsg(tip));
                if (link) whatsappLinks.push({ username: u.username, link });
            }
        }

        res.json({ success: true, message: `Stock tip added. Telegram: ${telegramCount}, WhatsApp: ${whatsappLinks.length}`, tip, whatsappLinks });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Update stock tip
app.put('/api/admin/stocktips/:id', checkAdmin, async (req, res) => {
    try {
        const data = loadStockTips();
        const tip = data.tips.find(t => t.id === req.params.id);
        if (!tip) return res.json({ success: false, message: 'Tip not found' });
        const { symbol, action, entry, target, sl, note, active, status } = req.body;
        if (symbol !== undefined) tip.symbol = symbol.toUpperCase();
        if (action !== undefined) tip.action = action.toUpperCase();
        if (entry !== undefined) tip.entry = entry;
        if (target !== undefined) tip.target = target;
        if (sl !== undefined) tip.sl = sl;
        if (note !== undefined) tip.note = note;
        if (active !== undefined) tip.active = active;
        if (status !== undefined) tip.status = status;
        saveStockTips(data);

        // Send status update to Telegram
        if (status && (status === 'target_done' || status === 'sl_hit')) {
            await sendTipStatusToTelegram(tip, status);
        }

        res.json({ success: true, message: 'Tip updated' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Delete stock tip
app.delete('/api/admin/stocktips/:id', checkAdmin, (req, res) => {
    try {
        const data = loadStockTips();
        data.tips = data.tips.filter(t => t.id !== req.params.id);
        saveStockTips(data);
        res.json({ success: true, message: 'Tip deleted' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// ========================================
// MARKET DATA
// ========================================
const HOLIDAYS = [
    '2025-01-26', '2025-02-26', '2025-03-14', '2025-03-31',
    '2025-04-10', '2025-04-14', '2025-04-18', '2025-05-01',
    '2025-08-15', '2025-08-27', '2025-10-02', '2025-10-21',
    '2025-11-08', '2025-11-25', '2025-12-25',
    '2026-01-26', '2026-03-03', '2026-04-03'
];

function getMarketStatus() {
    const now = moment().tz('Asia/Kolkata');
    const day = now.day();
    const todayStr = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm');
    
    if (HOLIDAYS.includes(todayStr)) return { status: 'CLOSED', label: 'Holiday — Closed' };
    if (day === 0 || day === 6) return { status: 'CLOSED', label: 'Weekend — Closed' };
    if (currentTime < '09:00') return { status: 'CLOSED', label: 'Pre-Open Soon' };
    if (currentTime < '09:15') return { status: 'PRE-OPEN', label: 'Pre-Open Session' };
    if (currentTime <= '15:30') return { status: 'OPEN', label: 'Market Open — LIVE' };
    return { status: 'CLOSED', label: 'Market Closed' };
}

const INDICES = [
    { name: 'NIFTY 50', base: 24500.50 },
    { name: 'BANK NIFTY', base: 52100.75 },
    { name: 'SENSEX', base: 80450.30 },
    { name: 'FIN NIFTY', base: 23100.40 }
];

const TOP_GAINERS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
const TOP_LOSERS = ['BAJFINANCE', 'AXISBANK', 'KOTAKBANK', 'SBIN', 'ITC'];
const SECTORS = ['AUTO', 'BANK', 'FINANCE', 'FMCG', 'IT', 'MEDIA', 'METAL', 'PHARMA', 'PSU BANK', 'REALTY', 'OIL & GAS', 'CONS DUR'];
const FO_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ADANIPORTS', 'ASIANPAINT', 'AXISBANK', 'BAJFINANCE', 'KOTAKBANK', 'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'WIPRO', 'NESTLEIND', 'JSWSTEEL', 'HINDUNILVR', 'ITC'];
const FO_GAINERS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'BHARTIARTL'];
const FO_LOSERS = ['BAJFINANCE', 'AXISBANK', 'KOTAKBANK', 'SBIN', 'ITC'];

function rand(min, max) { return Math.random() * (max - min) + min; }

// Upstox API Configuration
const UPSTOX_API_KEY = process.env.UPSTOX_API_KEY || '';
const UPSTOX_ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN || '';

// Server-side cache to avoid hitting Upstox rate limits
const MARKET_CACHE_FILE = path.join(__dirname, 'marketcache.json');

function loadMarketCache() {
    try {
        if (fs.existsSync(MARKET_CACHE_FILE)) {
            const raw = fs.readFileSync(MARKET_CACHE_FILE, 'utf-8');
            const data = JSON.parse(raw);
            console.log('📁 Loaded cached market data from file');
            data.indices = data.indices || { data: null, timestamp: 0 };
            data.stocks = data.stocks || { data: null, timestamp: 0, symbols: '' };
            data.heatmap = data.heatmap || { data: null, timestamp: 0 };
            data.indices.timestamp = 0;
            data.stocks.timestamp = 0;
            data.heatmap.timestamp = 0;
            return data;
        }
    } catch(e) { console.log('⚠️ Could not load market cache:', e.message); }
    return { indices: { data: null, timestamp: 0 }, stocks: { data: null, timestamp: 0, symbols: '' }, heatmap: { data: null, timestamp: 0 } };
}

function saveMarketCache(cache) {
    try {
        fs.writeFileSync(MARKET_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch(e) {}
}

let marketCache = loadMarketCache();
const INDICES_CACHE_TTL = 3000;   // 3 seconds (background refreshes every 2s)
const STOCKS_CACHE_TTL = 15000;   // 15 seconds (background refreshes every 10s)

// Check if market is open (NSE timing: 9:15 AM - 3:30 PM IST)
function isMarketOpen() {
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();
    const day = istTime.getDay();
    
    // Weekend check (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) return false;
    
    // Market hours: 9:15 AM to 3:30 PM
    const timeInMinutes = hour * 60 + minute;
    return timeInMinutes >= 555 && timeInMinutes <= 930;
}

// Instrument key mapping for indices - CORRECTED
const INDEX_KEYS = [
    'NSE_INDEX|Nifty 50',
    'BSE_INDEX|SENSEX',
    'NSE_INDEX|Nifty Bank',
    'NSE_INDEX|Nifty Fin Service'
];

// Map BOTH pipe and colon format to display names
const INDEX_DISPLAY_NAMES = {
    'NSE_INDEX|Nifty 50': 'NIFTY 50',
    'NSE_INDEX:Nifty 50': 'NIFTY 50',
    'BSE_INDEX|SENSEX': 'SENSEX',
    'BSE_INDEX:SENSEX': 'SENSEX',
    'NSE_INDEX|Nifty Bank': 'BANK NIFTY',
    'NSE_INDEX:Nifty Bank': 'BANK NIFTY',
    'NSE_INDEX|Nifty Fin Service': 'FIN NIFTY',
    'NSE_INDEX:Nifty Fin Service': 'FIN NIFTY'
};

// Stock ISIN mapping for Upstox V3 API
const STOCK_ISIN_KEYS = {
    'RELIANCE': 'NSE_EQ|INE002A01018',
    'TCS': 'NSE_EQ|INE467B01029',
    'HDFCBANK': 'NSE_EQ|INE040A01034',
    'INFY': 'NSE_EQ|INE009A01021',
    'ICICIBANK': 'NSE_EQ|INE090A01021',
    'SBIN': 'NSE_EQ|INE062A01020',
    'BHARTIARTL': 'NSE_EQ|INE397D01024',
    'ADANIPORTS': 'NSE_EQ|INE742F01042',
    'ASIANPAINT': 'NSE_EQ|INE021A01026',
    'AXISBANK': 'NSE_EQ|INE238A01034',
    'BAJFINANCE': 'NSE_EQ|INE296A01032',
    'KOTAKBANK': 'NSE_EQ|INE237A01036',
    'SUNPHARMA': 'NSE_EQ|INE044A01036',
    'TITAN': 'NSE_EQ|INE280A01028',
    'ULTRACEMCO': 'NSE_EQ|INE481G01011',
    'WIPRO': 'NSE_EQ|INE075A01022',
    'NESTLEIND': 'NSE_EQ|INE239A01024',
    'JSWSTEEL': 'NSE_EQ|INE019A01038',
    'HINDUNILVR': 'NSE_EQ|INE030A01027',
    'ITC': 'NSE_EQ|INE154A01025'
};

// Reverse map: ISIN key → symbol (both pipe and colon formats)
const ISIN_TO_SYMBOL = {};
Object.entries(STOCK_ISIN_KEYS).forEach(([sym, isin]) => {
    ISIN_TO_SYMBOL[isin] = sym;
    ISIN_TO_SYMBOL[isin.replace('|', ':')] = sym;
});

// Fetch LTP from Upstox V3 API
async function fetchUpstoxLTP(instrumentKeys) {
    const settings = loadSettings();
    const apiKey = settings.upstoxApiKey || process.env.UPSTOX_API_KEY || '';
    const accessToken = settings.upstoxAccessToken || process.env.UPSTOX_ACCESS_TOKEN || '';
    if (!apiKey || !accessToken) {
        console.log('⚠️ Upstox credentials not configured');
        return null;
    }
    
    try {
        const url = 'https://api.upstox.com/v3/market-quote/ltp?instrument_key=' + instrumentKeys.join(',');
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'X-API-Key': apiKey
            },
            timeout: 15000
        });
        
        if (response.data && response.data.status === 'success' && response.data.data) {
            return response.data.data;
        }
        return null;
    } catch (error) {
        if (error.response?.status === 429) {
            console.log('⚠️ Upstox rate limited - will retry later');
        } else {
            console.log('❌ Upstox API error:', error.response?.status, error.response?.data?.message || error.message);
        }
        return null;
    }
}

// Fetch stock data using V3 API with ISIN keys
async function fetchStockQuoteV2(symbols) {
    const s = loadSettings();
    const apiKey = s.upstoxApiKey || UPSTOX_API_KEY;
    const accessToken = s.upstoxAccessToken || UPSTOX_ACCESS_TOKEN;
    if (!apiKey || !accessToken) return null;
    
    try {
        const isinKeys = symbols.map(s => STOCK_ISIN_KEYS[s]).filter(k => k);
        if (isinKeys.length === 0) return null;
        const url = 'https://api.upstox.com/v3/market-quote/ltp?instrument_key=' + isinKeys.join(',');
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'X-API-Key': apiKey
            },
            timeout: 15000
        });
        
        if (response.data && response.data.status === 'success' && response.data.data) {
            const result = {};
            Object.keys(response.data.data).forEach(key => {
                const q = response.data.data[key];
                const symbol = ISIN_TO_SYMBOL[key] || key.split(/[:|]/).pop();
                if (symbols.includes(symbol)) {
                    const ltp = q.last_price || q.ltp || 0;
                    const cp = q.cp || q.close_price || ltp;
                    const change = ltp - cp;
                    const pct = cp > 0 ? (change / cp) * 100 : 0;
                    result[symbol] = {
                        symbol, ltp, change,
                        pct: parseFloat(pct.toFixed(2)),
                        volume: q.volume || 0
                    };
                }
            });
            if (Object.keys(result).length > 0) return result;
        }
        return null;
    } catch (error) {
        if (error.response?.status === 429) {
            console.log('⚠️ Upstox V2 rate limited');
        } else {
            console.log('❌ Upstox V2 error:', error.response?.status, error.response?.data?.message || error.message);
        }
        return null;
    }
}

// Fetch index data from Upstox with caching
async function fetchIndicesData() {
    const now = Date.now();
    if (marketCache.indices.data && (now - marketCache.indices.timestamp) < INDICES_CACHE_TTL) {
        return marketCache.indices.data;
    }
    
    const data = await fetchUpstoxLTP(INDEX_KEYS);
    
    if (data && Object.keys(data).length > 0) {
        const mapped = {};
        Object.keys(data).forEach(key => {
            const q = data[key];
            const cp = q.cp || 0;
            const ltp = q.last_price || 0;
            const change = ltp - cp;
            const pct = cp > 0 ? (change / cp) * 100 : 0;
            mapped[key] = {
                name: INDEX_DISPLAY_NAMES[key] || key.replace('NSE_INDEX:', '').replace('BSE_INDEX:', ''),
                ltp: ltp.toFixed(2),
                change: change.toFixed(2),
                pct: parseFloat(pct.toFixed(2))
            };
        });
        // Return in INDEX_KEYS order, matching pipe or colon format
        const result = INDEX_KEYS.map(ik => {
            const colonKey = ik.replace('|', ':');
            return mapped[ik] || mapped[colonKey] || null;
        }).filter(Boolean);
        if (result.length > 0) {
            marketCache.indices = { data: result, timestamp: now };
            saveMarketCache(marketCache);
            return result;
        }
    }
    
    return marketCache.indices.data || null;
}

// Fetch stock data - try V2 first, fallback to V3 ISIN, with caching
async function fetchStockQuote(symbols) {
    const symbolsKey = symbols.sort().join(',');
    const now = Date.now();
    
    // Check if we already have this exact set cached
    if (marketCache.stocks.data && marketCache.stocks.symbols === symbolsKey && (now - marketCache.stocks.timestamp) < STOCKS_CACHE_TTL) {
        return marketCache.stocks.data;
    }
    
    // Check if we have all these symbols individually cached (merged from previous fetches)
    if (marketCache.stocks.data) {
        const allCached = symbols.every(s => marketCache.stocks.data[s] && marketCache.stocks.data[s].ltp > 0);
        if (allCached && (now - marketCache.stocks.timestamp) < STOCKS_CACHE_TTL) {
            const filtered = {};
            symbols.forEach(s => { filtered[s] = marketCache.stocks.data[s]; });
            return filtered;
        }
    }
    
    // Try V2 API first (simpler, uses symbol names)
    let result = await fetchStockQuoteV2(symbols);
    
    // Fallback to V3 with ISIN keys
    if (!result || Object.keys(result).length === 0) {
        const isinKeys = symbols.map(s => STOCK_ISIN_KEYS[s]).filter(k => k);
        if (isinKeys.length > 0) {
            const data = await fetchUpstoxLTP(isinKeys);
            if (data && Object.keys(data).length > 0) {
                result = {};
                Object.keys(data).forEach(key => {
                    const symbol = ISIN_TO_SYMBOL[key] || key.split(/[:|]/).pop();
                    if (STOCK_ISIN_KEYS[symbol]) {
                        const q = data[key];
                        const ltp = q.last_price || 0;
                        const cp = q.cp || 0;
                        const change = ltp - cp;
                        const pct = cp > 0 ? (change / cp) * 100 : 0;
                        result[symbol] = { symbol, ltp, change, pct: parseFloat(pct.toFixed(2)), volume: q.volume || 0 };
                    }
                });
            }
        }
    }
    
    if (result && Object.keys(result).length > 0) {
        // Merge with existing cache data
        const merged = { ...(marketCache.stocks.data || {}), ...result };
        marketCache.stocks = { data: merged, timestamp: now, symbols: symbolsKey };
        saveMarketCache(marketCache);
        return result;
    }
    
    // Return whatever we have from cache
    if (marketCache.stocks.data) {
        const filtered = {};
        symbols.forEach(s => { if (marketCache.stocks.data[s]) filtered[s] = marketCache.stocks.data[s]; });
        if (Object.keys(filtered).length > 0) return filtered;
    }
    
    return null;
}

// Legacy function for demo data (fallback)
function genStock(symbol) {
    const ltp = parseFloat(rand(100, 3000).toFixed(2));
    const pct = parseFloat(rand(-3, 3).toFixed(2));
    return { 
        symbol, 
        ltp, 
        change: parseFloat((ltp * pct / 100).toFixed(2)), 
        pct 
    };
}

// Protected data routes
app.get('/api/indices', checkUserAuth, async (req, res) => {
    const liveData = await fetchIndicesData();
    if (liveData && liveData.length > 0) {
        return res.json(liveData);
    }
    // Return cached data even if market is closed
    if (marketCache.indices.data && marketCache.indices.data.length > 0) {
        return res.json(marketCache.indices.data);
    }
    res.json([]);
});

// Admin indices endpoint
app.get('/api/admin/indices', checkAdmin, async (req, res) => {
    const liveData = await fetchIndicesData();
    if (liveData && liveData.length > 0) {
        return res.json(liveData);
    }
    if (marketCache.indices.data && marketCache.indices.data.length > 0) {
        return res.json(marketCache.indices.data);
    }
    res.json([]);
});

app.get('/api/gainers-losers', checkUserAuth, async (req, res) => {
    const symbols = [...TOP_GAINERS, ...TOP_LOSERS];
    const liveData = await fetchStockQuote(symbols);
    
    if (liveData && Object.keys(liveData).length > 0) {
        const allStocks = Object.values(liveData).filter(s => s.pct !== undefined);
        const gainers = allStocks.filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
        const losers = allStocks.filter(s => s.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5);
        return res.json({ gainers, losers });
    }
    
    res.json({ gainers: [], losers: [] });
});

// Sector → representative stocks mapping
const SECTOR_STOCKS = {
    'AUTO': ['TITAN'],
    'BANK': ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
    'FINANCE': ['BAJFINANCE', 'HDFCBANK', 'ICICIBANK'],
    'FMCG': ['ITC', 'HINDUNILVR', 'NESTLEIND'],
    'IT': ['TCS', 'INFY', 'WIPRO'],
    'MEDIA': ['RELIANCE'],
    'METAL': ['JSWSTEEL'],
    'PHARMA': ['SUNPHARMA'],
    'PSU BANK': ['SBIN'],
    'REALTY': ['ADANIPORTS'],
    'OIL & GAS': ['RELIANCE'],
    'CONS DUR': ['TITAN', 'ASIANPAINT']
};

// Heatmap with live data (updates every 30s)
async function getHeatmapData() {
    const now = Date.now();
    if (marketCache.heatmap.data && (now - marketCache.heatmap.timestamp) < 30000) return marketCache.heatmap.data;

    const allSymbols = [...new Set(Object.values(SECTOR_STOCKS).flat())].filter(Boolean);
    if (allSymbols.length === 0) return SECTORS.map(s => ({ name: s, pct: 0 }));

    const stockData = await fetchStockQuote(allSymbols);
    if (!stockData) return SECTORS.map(s => ({ name: s, pct: 0 }));

    const data = SECTORS.map(sector => {
        const stocks = SECTOR_STOCKS[sector] || [];
        const validStocks = stocks.filter(s => stockData[s] && stockData[s].pct !== undefined);
        if (validStocks.length === 0) return { name: sector, pct: 0 };
        const avgPct = validStocks.reduce((sum, s) => sum + stockData[s].pct, 0) / validStocks.length;
        return { name: sector, pct: parseFloat(avgPct.toFixed(2)) };
    });

    marketCache.heatmap = { data, timestamp: now };
    saveMarketCache(marketCache);
    return data;
}

app.get('/api/heatmap', checkUserAuth, async (req, res) => {
    res.json(await getHeatmapData());
});

app.get('/api/fo-stocks', checkUserAuth, async (req, res) => {
    const symbols = [...FO_GAINERS, ...FO_LOSERS];
    const data = await fetchStockQuote(symbols);
    
    if (data && Object.keys(data).length > 0) {
        const gainers = symbols.filter(s => data[s] && data[s].pct > 0).map(s => data[s]).sort((a, b) => b.pct - a.pct).slice(0, 5);
        const losers = symbols.filter(s => data[s] && data[s].pct < 0).map(s => data[s]).sort((a, b) => a.pct - b.pct).slice(0, 5);
        return res.json({ gainers, losers });
    }
    
    res.json({ gainers: [], losers: [] });
});

app.get('/api/fno-all', checkUserAuth, async (req, res) => {
    const data = await fetchStockQuote(FO_STOCKS);
    if (data && Object.keys(data).length > 0) {
        return res.json(Object.values(data));
    }
    res.json([]);
});

app.get('/api/signals', checkUserAuth, async (req, res) => {
    const signals = [];
    const allStocks = [...TOP_GAINERS, ...TOP_LOSERS, ...FO_STOCKS].slice(0, 15);
    
    // Try to use live stock data for signals
    const liveData = await fetchStockQuote(allStocks);
    
    allStocks.forEach(sym => {
        let ltp = 0;
        if (liveData && liveData[sym]) {
            ltp = liveData[sym].ltp;
        }
        if (ltp <= 0) return;
        
        const isBuy = Math.random() > 0.5;
        const target = isBuy ? parseFloat((ltp * 1.04).toFixed(2)) : parseFloat((ltp * 0.96).toFixed(2));
        const sl = isBuy ? parseFloat((ltp * 0.97).toFixed(2)) : parseFloat((ltp * 1.03).toFixed(2));
        
        signals.push({
            symbol: sym,
            signal: isBuy ? 'BUY' : 'SELL',
            entry: ltp,
            target: target,
            sl: sl,
            status: 'ACTIVE',
            time: moment().format('HH:mm')
        });
    });
    
    res.json(signals);
});

// ========================================
// NEW ADMIN FEATURES
// ========================================

// 1. Change Admin Password
app.post('/api/admin/change-password', checkAdmin, (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) {
            return res.json({ success: false, message: 'Password must be at least 4 characters' });
        }
        const settings = loadSettings();
        settings.adminPassword = newPassword;
        saveSettings(settings);
        ADMIN_PASSWORD = newPassword;
        logActivity('password_changed', 'Admin password updated');
        res.json({ success: true, message: 'Password updated! Use new password next login.' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// 2. Login History
app.get('/api/admin/login-history', checkAdmin, (req, res) => {
    const log = loadLoginHistory();
    res.json({ success: true, logins: log.logins.slice(0, 30) });
});

// 3. Bulk Category Change
app.post('/api/admin/bulk-category', checkAdmin, (req, res) => {
    try {
        const { usernames, category } = req.body;
        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return res.json({ success: false, message: 'Select at least one user' });
        }
        if (!category) return res.json({ success: false, message: 'Category required' });
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (usernames.includes(u.username)) {
                u.category = category;
                count++;
            }
        });
        saveUsers(data);
        logActivity('bulk_category', `${count} users → ${category}`);
        res.json({ success: true, message: `${count} user(s) moved to ${category}` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// 4. Tip Performance
app.get('/api/admin/tip-performance', checkAdmin, (req, res) => {
    const data = loadStockTips();
    const total = data.tips.length;
    const active = data.tips.filter(t => t.status === 'active').length;
    const targetDone = data.tips.filter(t => t.status === 'target_done').length;
    const slHit = data.tips.filter(t => t.status === 'sl_hit').length;
    const closed = targetDone + slHit;
    const winRate = closed > 0 ? ((targetDone / closed) * 100).toFixed(1) : 0;
    res.json({ success: true, performance: { total, active, targetDone, slHit, winRate } });
});

// 5. Scheduled Messages
app.post('/api/admin/schedule-message', checkAdmin, (req, res) => {
    try {
        const { usernames, message, msgColor, scheduledAt } = req.body;
        if (!message || !scheduledAt) return res.json({ success: false, message: 'Message and schedule time required' });
        const data = loadScheduledMsgs();
        const msg = {
            id: 'sched_' + Date.now(),
            usernames: usernames || [],
            message: message.trim(),
            msgColor: msgColor || '#ff6b35',
            scheduledAt: new Date(scheduledAt).toISOString(),
            sent: false,
            createdAt: new Date().toISOString()
        };
        data.messages.unshift(msg);
        saveScheduledMsgs(data);
        logActivity('message_scheduled', `Scheduled for ${scheduledAt}`);
        res.json({ success: true, message: 'Message scheduled!', schedule: msg });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/scheduled-messages', checkAdmin, (req, res) => {
    const data = loadScheduledMsgs();
    res.json({ success: true, messages: data.messages });
});

app.delete('/api/admin/schedule-message/:id', checkAdmin, (req, res) => {
    const data = loadScheduledMsgs();
    data.messages = data.messages.filter(m => m.id !== req.params.id);
    saveScheduledMsgs(data);
    res.json({ success: true, message: 'Scheduled message deleted' });
});

// 6. Online Users Count
let onlineUsers = new Set();
app.post('/api/ping', (req, res) => {
    const userId = req.headers['user-id'];
    if (userId) {
        onlineUsers.add(userId);
        setTimeout(() => onlineUsers.delete(userId), 30000);
    }
    res.json({ online: onlineUsers.size });
});

// 7. Expiring Users (for header alert)
app.get('/api/admin/expiring-users', checkAdmin, (req, res) => {
    const data = loadUsers();
    const expiring = data.users.filter(u => {
        if (!u.approved) return false;
        const days = getDaysUntilExpiry(u);
        return days > 0 && days <= 7;
    }).map(u => ({
        username: u.username,
        fullName: u.fullName,
        daysLeft: getDaysUntilExpiry(u)
    }));
    res.json({ success: true, expiring: expiring.sort((a, b) => a.daysLeft - b.daysLeft) });
});

// ========================================
// PAYMENT REMINDERS
// ========================================

// Send reminders to selected users (or all expiring if none specified)
app.post('/api/admin/send-reminders', checkAdmin, async (req, res) => {
    try {
        const { usernames } = req.body;
        const data = loadUsers();
        let sentCount = 0;
        let sentTelegram = 0;
        let sentWhatsApp = 0;

        for (const u of data.users) {
            if (!u.approved) continue;
            const days = getDaysUntilExpiry(u);
            if (days > 0 && days <= 7) {
                // If usernames provided, only send to selected ones
                if (usernames && usernames.length > 0 && !usernames.includes(u.username)) continue;
                const reminderMsg = `⚠️ Payment Reminder\n\nHi ${u.fullName || u.username},\n\nYour subscription expires in ${days} day(s).\nRenew now to continue getting stock tips.\n\nContact: Vaibhav\nBearFighter Trading`;

                // Send via Telegram
                if (u.telegramChatId) {
                    await sendToTelegramChat(u.telegramChatId, reminderMsg);
                    sentTelegram++;
                }

                // Send via WhatsApp
                if (u.whatsappNumber) {
                    const waLink = generateWhatsAppLink(u.whatsappNumber, reminderMsg);
                    if (waLink) sentWhatsApp++;
                }

                // Set as dashboard message
                u.message = `⚠️ Your subscription expires in ${days} day(s)! Renew now.`;
                u.msgColor = '#ff1744';
                sentCount++;
            }
        }

        saveUsers(data);
        logActivity('payment_reminders', `Sent to ${sentCount} users — Telegram: ${sentTelegram}, WhatsApp: ${sentWhatsApp}`);

        // Generate WhatsApp links for admin to send manually
        const waLinks = [];
        for (const u of data.users) {
            if (!u.approved) continue;
            const days = getDaysUntilExpiry(u);
            if (days > 0 && days <= 7 && u.whatsappNumber) {
                if (usernames && usernames.length > 0 && !usernames.includes(u.username)) continue;
                const reminderMsg = `⚠️ Hi ${u.fullName || u.username}, your subscription expires in ${days} day(s). Renew now! Contact: Vaibhav`;
                const link = generateWhatsAppLink(u.whatsappNumber, reminderMsg);
                if (link) waLinks.push({ username: u.username, daysLeft: days, link });
            }
        }

        res.json({ success: true, message: `Reminders sent to ${sentCount} user(s)`, sentCount, sentTelegram, sentWhatsApp, waLinks });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Get reminder status
app.get('/api/admin/reminder-status', checkAdmin, (req, res) => {
    const data = loadUsers();
    const expiring = [];
    data.users.forEach(u => {
        if (!u.approved) return;
        const days = getDaysUntilExpiry(u);
        if (days > 0 && days <= 7) {
            expiring.push({
                username: u.username,
                fullName: u.fullName,
                daysLeft: days,
                hasTelegram: !!u.telegramChatId,
                hasWhatsApp: !!u.whatsappNumber
            });
        }
    });
    res.json({ success: true, expiring: expiring.sort((a, b) => a.daysLeft - b.daysLeft) });
});

// Auto reminder check every 6 hours
setInterval(async () => {
    const data = loadUsers();
    for (const u of data.users) {
        if (!u.approved) continue;
        const days = getDaysUntilExpiry(u);
        if (days === 3 || days === 1) {
            const reminderMsg = `⚠️ Payment Reminder\n\nHi ${u.fullName || u.username},\nYour subscription expires in ${days} day(s). Renew now!\n\n— Vaibhav, BearFighter Trading`;
            if (u.telegramChatId) {
                await sendToTelegramChat(u.telegramChatId, reminderMsg);
            }
            u.message = `⚠️ Your subscription expires in ${days} day(s)! Renew now.`;
            u.msgColor = '#ff1744';
        }
    }
    saveUsers(data);
}, 21600000); // Every 6 hours

// Check scheduled messages every minute
setInterval(() => {
    const now = new Date();
    const data = loadScheduledMsgs();
    let changed = false;
    data.messages.forEach(async msg => {
        if (!msg.sent && new Date(msg.scheduledAt) <= now) {
            msg.sent = true;
            changed = true;
            const usersData = loadUsers();
            for (const u of usersData.users) {
                if (msg.usernames.length === 0 || msg.usernames.includes(u.username)) {
                    u.message = msg.message;
                    u.msgColor = msg.msgColor;
                    if (u.telegramChatId) await sendBroadcastToUser(msg.message, u);
                }
            }
            saveUsers(usersData);
            logActivity('scheduled_sent', `Scheduled message delivered`);
        }
    });
    if (changed) saveScheduledMsgs(data);
}, 60000);

// ========================================
// DASHBOARD SETTINGS (sections visibility + index selection)
// ========================================
const AVAILABLE_INDICES = [
    { key: 'NSE_INDEX|Nifty 50', name: 'NIFTY 50' },
    { key: 'NSE_INDEX|Nifty Bank', name: 'BANK NIFTY' },
    { key: 'BSE_INDEX|SENSEX', name: 'SENSEX' },
    { key: 'NSE_INDEX|Nifty Fin Service', name: 'FIN NIFTY' }
];

const DEFAULT_DASHBOARD_SETTINGS = {
    selectedIndices: ['NSE_INDEX|Nifty 50', 'BSE_INDEX|SENSEX', 'NSE_INDEX|Nifty Bank'],
    sections: {
        indices: true,
        stockTips: true,
        gainersLosers: false,
        heatmap: true,
        foStocks: false,
        fnoGainersLosers: false,
        signals: true
    }
};

function loadDashboardSettings() {
    try {
        const settings = loadSettings();
        if (!settings.dashboardSections) {
            settings.dashboardSections = DEFAULT_DASHBOARD_SETTINGS.sections;
            saveSettings(settings);
        }
        if (!settings.selectedIndices) {
            settings.selectedIndices = DEFAULT_DASHBOARD_SETTINGS.selectedIndices;
            saveSettings(settings);
        }
        return {
            selectedIndices: settings.selectedIndices || DEFAULT_DASHBOARD_SETTINGS.selectedIndices,
            sections: settings.dashboardSections || DEFAULT_DASHBOARD_SETTINGS.sections
        };
    } catch (e) {
        return DEFAULT_DASHBOARD_SETTINGS;
    }
}

// Public: get dashboard settings (for users)
app.get('/api/dashboard-settings', (req, res) => {
    res.json(loadDashboardSettings());
});

// Admin: get all available indices + current settings
app.get('/api/admin/dashboard-settings', checkAdmin, (req, res) => {
    const settings = loadDashboardSettings();
    res.json({
        success: true,
        availableIndices: AVAILABLE_INDICES,
        selectedIndices: settings.selectedIndices,
        sections: settings.sections
    });
});

// Admin: update dashboard settings
app.put('/api/admin/dashboard-settings', checkAdmin, (req, res) => {
    try {
        const { selectedIndices, sections } = req.body;
        const settings = loadSettings();
        if (selectedIndices && Array.isArray(selectedIndices)) {
            settings.selectedIndices = selectedIndices.slice(0, 4);
        }
        if (sections && typeof sections === 'object') {
            settings.dashboardSections = { ...DEFAULT_DASHBOARD_SETTINGS.sections, ...sections };
        }
        saveSettings(settings);
        // Update live INDEX_KEYS from settings
        updateIndexKeys();
        logActivity('dashboard_settings', 'Dashboard layout updated');
        res.json({ success: true, message: 'Dashboard settings updated' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Update INDEX_KEYS based on admin settings
function updateIndexKeys() {
    const settings = loadDashboardSettings();
    INDEX_KEYS.length = 0;
    settings.selectedIndices.forEach(k => {
        if (!INDEX_KEYS.includes(k)) INDEX_KEYS.push(k);
    });
    if (INDEX_KEYS.length === 0) {
        INDEX_KEYS.push('NSE_INDEX|Nifty 50', 'BSE_INDEX|SENSEX', 'NSE_INDEX|Nifty Bank');
    }
}

// ========================================
// BACKGROUND DATA REFRESHER
// Runs every 2s for indices, 10s for stocks
// Data served from cache = instant response
// ========================================
async function refreshIndicesBackground() {
    try {
        const keys = [...INDEX_KEYS];
        const data = await fetchUpstoxLTP(keys);
        if (data && Object.keys(data).length > 0) {
            const mapped = {};
            Object.keys(data).forEach(key => {
                const q = data[key];
                const cp = q.cp || 0;
                const ltp = q.last_price || 0;
                const change = ltp - cp;
                const pct = cp > 0 ? (change / cp) * 100 : 0;
                mapped[key] = {
                    name: INDEX_DISPLAY_NAMES[key] || key.replace('NSE_INDEX:', '').replace('BSE_INDEX:', ''),
                    ltp: ltp.toFixed(2),
                    change: change.toFixed(2),
                    pct: parseFloat(pct.toFixed(2))
                };
            });
            // Build lookup by normalizing keys (pipe to colon)
            const byName = {};
            Object.keys(mapped).forEach(k => { byName[k] = mapped[k]; });
            const result = INDEX_KEYS.map(ik => {
                // Try direct match first, then convert pipe to colon
                const colonKey = ik.replace('|', ':');
                return mapped[ik] || mapped[colonKey] || null;
            }).filter(Boolean);
            if (result.length > 0) {
                marketCache.indices = { data: result, timestamp: Date.now() };
            }
        }
    } catch (e) {}
}

async function refreshStocksBackground() {
    try {
        const allSymbols = [...new Set([...TOP_GAINERS, ...TOP_LOSERS, ...FO_STOCKS])];
        const result = await fetchStockQuote(allSymbols);
        if (result && Object.keys(result).length > 0) {
            marketCache.stocks = { data: result, timestamp: Date.now(), symbols: allSymbols.sort().join(',') };
        }
    } catch (e) {}
}

// Start background refreshers
updateIndexKeys(); // Load selected indices from settings first
setInterval(refreshIndicesBackground, 2000);
setInterval(refreshStocksBackground, 10000);
// Initial refresh
setTimeout(refreshIndicesBackground, 1000);
setTimeout(refreshStocksBackground, 2000);

// ========================================
// SERVER START
// ========================================
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🐻 BEAR FIGHTER TRADING - Login System`);
    console.log(`   By Vaibhav`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
    console.log(`📊 Background refresher: 2s (indices), 10s (stocks)`);
    console.log(`\n📋 First time setup:`);
    console.log(`   1. Run: node create-user.js`);
    console.log(`   2. Login with username/password created`);
    console.log(`${'='.repeat(50)}\n`);
});
