// ========================================
// BEAR FIGHTER TRADING - Complete Server
// By Vaibhav
// ========================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const moment = require('moment-timezone');
const axios = require('axios');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.static('public', {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.htm') || filePath.includes('sw.js')) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { success: false, message: 'Too many registrations. Try again later.' } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 500, message: { success: false, message: 'Too many requests. Slow down.' } });

const SKIP_RATE_LIMIT_PATHS = ['/api/indices', '/api/heatmap', '/api/heatmap/sector-stocks'];
app.use('/api', (req, res, next) => {
    if (SKIP_RATE_LIMIT_PATHS.includes(req.path)) return next();
    apiLimiter(req, res, next);
});

// Prevent API caching on mobile browsers
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
});

console.log('🐻 BEAR FIGHTER TRADING - Starting...');

// ========================================
// ROUTES - ADMIN & DASHBOARD
// ========================================
app.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get public settings (disclaimer text) — NO SECRETS
app.get('/api/settings', (req, res) => {
    const settings = loadSettings();
    res.json({
        success: true,
        disclaimerText: settings.disclaimerText,
        disclaimerBgColor: settings.disclaimerBgColor || '#ffeb3b',
        disclaimerTextColor: settings.disclaimerTextColor || '#000000',
        disclaimerSpeed: settings.disclaimerSpeed || 8,
        disclaimerFontSize: settings.disclaimerFontSize || 10,
        showTipSebiText: settings.showTipSebiText !== false,
        sebiDisclaimerText: settings.sebiDisclaimerText || 'I AM NOT SEBI REGISTERED — FOR EDUCATIONAL PURPOSES ONLY',
        showHeaderTelegram: settings.showHeaderTelegram === true,
        showHeaderWhatsApp: settings.showHeaderWhatsApp === true,
        headerTelegramLink: settings.headerTelegramLink || '',
        headerWhatsAppLink: settings.headerWhatsAppLink || '',
        birthdayWishes: settings.birthdayWishes || { 1: 'Happy Birthday! 🎉' },
        plans: settings.plans || [{ id: 'standard', name: 'Standard Plan', days: 30, price: 0 }],
        upiQrImage: settings.upiQrImage || '',
        upiPaymentId: settings.upiPaymentId || '',
        forexReferralName: settings.forexReferralName || '',
        forexReferralLink: settings.forexReferralLink || '',
        forexReferralLogo: settings.forexReferralLogo || '',
        forexBannerImage: settings.forexBannerImage || '',
        forexBannerLink: settings.forexBannerLink || '',
        forexTopBannerImage: settings.forexTopBannerImage || '',
        forexTopBannerLink: settings.forexTopBannerLink || '',
        forexShowBanner: settings.forexShowBanner !== false,
        forexShowTopBanner: settings.forexShowTopBanner !== false,
        forexSignals: settings.forexSignals || [],
        forexPairs: settings.forexPairs || [],
        forexMost: settings.forexMost || [],
        forexCryptos: settings.forexCryptos || [],
        forexGlobalIndices: settings.forexGlobalIndices || [],
        forexAsianIndices: settings.forexAsianIndices || [],
        telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || ''
    });
});

// Admin-only settings with secrets
app.get('/api/admin/settings', checkAdmin, (req, res) => {
    const settings = loadSettings();
    res.json({
        success: true,
        disclaimerText: settings.disclaimerText,
        disclaimerBgColor: settings.disclaimerBgColor || '#ffeb3b',
        disclaimerTextColor: settings.disclaimerTextColor || '#000000',
        disclaimerSpeed: settings.disclaimerSpeed || 8,
        disclaimerFontSize: settings.disclaimerFontSize || 10,
        upstoxApiKey: settings.upstoxApiKey || '',
        upstoxAccessToken: settings.upstoxAccessToken || '',
        telegramBotToken: settings.telegramBotToken || '',
        telegramChatId: settings.telegramChatId || '',
        adminPersonalTelegramId: settings.adminPersonalTelegramId || '',
        showTipSebiText: settings.showTipSebiText !== false,
        sebiDisclaimerText: settings.sebiDisclaimerText || 'I AM NOT SEBI REGISTERED — FOR EDUCATIONAL PURPOSES ONLY',
        showHeaderTelegram: settings.showHeaderTelegram === true,
        showHeaderWhatsApp: settings.showHeaderWhatsApp === true,
        headerTelegramLink: settings.headerTelegramLink || '',
        headerWhatsAppLink: settings.headerWhatsAppLink || '',
        birthdayWishes: settings.birthdayWishes || { 1: 'Happy Birthday! 🎉' },
        plans: settings.plans || [{ id: 'standard', name: 'Standard Plan', days: 30, price: 0 }],
        upiQrImage: settings.upiQrImage || '',
        upiPaymentId: settings.upiPaymentId || '',
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage: settings.maintenanceMessage || '',
        maintenanceEndsAt: settings.maintenanceEndsAt || null,
        dailyMaintenance: settings.dailyMaintenance || { enabled: false, startHour: 2, startMin: 0, endHour: 7, endMin: 0, message: '' },
        forexReferralName: settings.forexReferralName || '',
        forexReferralLink: settings.forexReferralLink || '',
        forexReferralLogo: settings.forexReferralLogo || '',
        forexBannerImage: settings.forexBannerImage || '',
        forexBannerLink: settings.forexBannerLink || '',
        forexTopBannerImage: settings.forexTopBannerImage || '',
        forexTopBannerLink: settings.forexTopBannerLink || '',
        forexShowBanner: settings.forexShowBanner !== false,
        forexShowTopBanner: settings.forexShowTopBanner !== false,
        forexSignals: settings.forexSignals || [],
        forexPairs: settings.forexPairs || [],
        forexMost: settings.forexMost || [],
        forexCryptos: settings.forexCryptos || [],
        forexGlobalIndices: settings.forexGlobalIndices || [],
        forexAsianIndices: settings.forexAsianIndices || []
    });
});

// Admin: update settings
app.put('/api/admin/settings', checkAdmin, (req, res) => {
    try {
        const { disclaimerText, disclaimerBgColor, disclaimerTextColor, disclaimerSpeed, disclaimerFontSize, upstoxApiKey, upstoxAccessToken, telegramBotToken, telegramChatId, adminPersonalTelegramId, showTipSebiText, sebiDisclaimerText, showHeaderTelegram, showHeaderWhatsApp, headerTelegramLink, headerWhatsAppLink, birthdayWishes, plans, upiQrImage, upiPaymentId, forexReferralName, forexReferralLink, forexReferralLogo, forexBannerImage, forexBannerLink, forexTopBannerImage, forexTopBannerLink, forexShowBanner, forexShowTopBanner, forexSignals, forexPairs, forexMost, forexCryptos, forexGlobalIndices, forexAsianIndices } = req.body;
        const settings = loadSettings();
        if (disclaimerText !== undefined) settings.disclaimerText = disclaimerText;
        if (disclaimerBgColor !== undefined) settings.disclaimerBgColor = disclaimerBgColor;
        if (disclaimerTextColor !== undefined) settings.disclaimerTextColor = disclaimerTextColor;
        if (disclaimerSpeed !== undefined) settings.disclaimerSpeed = parseInt(disclaimerSpeed) || 8;
        if (disclaimerFontSize !== undefined) settings.disclaimerFontSize = parseInt(disclaimerFontSize) || 10;
        if (upstoxApiKey !== undefined) settings.upstoxApiKey = upstoxApiKey;
        if (upstoxAccessToken !== undefined) settings.upstoxAccessToken = upstoxAccessToken;
        if (telegramBotToken !== undefined) settings.telegramBotToken = telegramBotToken;
        if (telegramChatId !== undefined) settings.telegramChatId = telegramChatId;
        if (adminPersonalTelegramId !== undefined) settings.adminPersonalTelegramId = adminPersonalTelegramId;
        if (showTipSebiText !== undefined) settings.showTipSebiText = showTipSebiText;
        if (sebiDisclaimerText !== undefined) settings.sebiDisclaimerText = sebiDisclaimerText;
        if (showHeaderTelegram !== undefined) settings.showHeaderTelegram = showHeaderTelegram;
        if (showHeaderWhatsApp !== undefined) settings.showHeaderWhatsApp = showHeaderWhatsApp;
        if (headerTelegramLink !== undefined) settings.headerTelegramLink = headerTelegramLink;
        if (headerWhatsAppLink !== undefined) settings.headerWhatsAppLink = headerWhatsAppLink;
        if (birthdayWishes !== undefined) settings.birthdayWishes = { 1: birthdayWishes[1] || birthdayWishes || settings.birthdayWishes['1'] || 'Happy Birthday! 🎉' };
        if (plans !== undefined) settings.plans = Array.isArray(plans) ? plans : settings.plans || [];
        if (upiQrImage !== undefined) settings.upiQrImage = upiQrImage;
        if (upiPaymentId !== undefined) settings.upiPaymentId = upiPaymentId;
        if (forexReferralName !== undefined) settings.forexReferralName = forexReferralName;
        if (forexReferralLink !== undefined) settings.forexReferralLink = forexReferralLink;
        if (forexReferralLogo !== undefined) settings.forexReferralLogo = forexReferralLogo;
        if (forexBannerImage !== undefined) settings.forexBannerImage = forexBannerImage;
        if (forexBannerLink !== undefined) settings.forexBannerLink = forexBannerLink;
        if (forexTopBannerImage !== undefined) settings.forexTopBannerImage = forexTopBannerImage;
        if (forexTopBannerLink !== undefined) settings.forexTopBannerLink = forexTopBannerLink;
        if (forexShowBanner !== undefined) settings.forexShowBanner = !!forexShowBanner;
        if (forexShowTopBanner !== undefined) settings.forexShowTopBanner = !!forexShowTopBanner;
        if (forexSignals !== undefined) settings.forexSignals = Array.isArray(forexSignals) ? forexSignals : [];
        if (forexPairs !== undefined) settings.forexPairs = Array.isArray(forexPairs) ? forexPairs : [];
        if (forexMost !== undefined) settings.forexMost = Array.isArray(forexMost) ? forexMost : [];
        if (forexCryptos !== undefined) settings.forexCryptos = Array.isArray(forexCryptos) ? forexCryptos : [];
        if (forexGlobalIndices !== undefined) settings.forexGlobalIndices = Array.isArray(forexGlobalIndices) ? forexGlobalIndices : [];
        if (forexAsianIndices !== undefined) settings.forexAsianIndices = Array.isArray(forexAsianIndices) ? forexAsianIndices : [];
        saveSettings(settings);
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Toggle maintenance mode (manual ON/OFF)
app.post('/api/admin/maintenance', checkAdmin, (req, res) => {
    try {
        const { enabled, message } = req.body;
        const settings = loadSettings();
        settings.maintenanceMode = enabled;
        settings.maintenanceSource = 'manual'; // Mark as manual
        if (message !== undefined && message !== '') settings.maintenanceMessage = message;
        if (!enabled) {
            settings.maintenanceManualOff = Date.now();
            console.log('[MAINTENANCE] Admin MANUAL OFF');
        } else {
            delete settings.maintenanceManualOff;
            console.log('[MAINTENANCE] Admin MANUAL ON — msg:', (message || '').substring(0, 40));
        }
        saveSettings(settings);
        if (db.isConnected()) db.immediateSave('settings', settings);
        logActivity('maintenance_' + (enabled ? 'on' : 'off'), message || '');
        res.json({ success: true, maintenance: settings.maintenanceMode });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Save maintenance message only (without toggling)
app.post('/api/admin/maintenance/message', checkAdmin, (req, res) => {
    try {
        const { message } = req.body;
        const settings = loadSettings();
        settings.maintenanceMessage = message || '';
        saveSettings(settings);
        if (db.isConnected()) db.immediateSave('settings', settings);
        console.log('[MAINTENANCE] Message updated:', (message || '').substring(0, 60));
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Schedule maintenance
app.post('/api/admin/maintenance/schedule', checkAdmin, (req, res) => {
    try {
        const { scheduleStart, scheduleEnd, messageTemplate, notifyUsers } = req.body;
        const settings = loadSettings();
        settings.maintenanceSchedule = {
            enabled: true,
            start: scheduleStart || null,
            end: scheduleEnd || null,
            messageTemplate: messageTemplate || '🔧 Bear Fighter Trading System is under scheduled maintenance from {start} to {end}. We will be back soon!',
            notifyUsers: !!notifyUsers,
            notified: false
        };
        // Set source to schedule so interval takes over management
        settings.maintenanceSource = 'schedule';
        saveSettings(settings);
        logActivity('maintenance_scheduled', `Start: ${scheduleStart}, End: ${scheduleEnd}`);
        res.json({ success: true, schedule: settings.maintenanceSchedule });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Cancel maintenance schedule
app.post('/api/admin/maintenance/cancel-schedule', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        settings.maintenanceSchedule = { enabled: false, start: null, end: null, messageTemplate: '', notifyUsers: false, notified: false };
        settings.maintenanceMode = false;
        if (settings.maintenanceSource === 'schedule') settings.maintenanceSource = '';
        saveSettings(settings);
        logActivity('maintenance_schedule_cancelled', '');
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Set daily recurring maintenance (e.g., 2am-7am)
app.post('/api/admin/maintenance/daily', checkAdmin, (req, res) => {
    try {
        const { enabled, startHour, startMin, endHour, endMin, message } = req.body;
        const settings = loadSettings();
        settings.dailyMaintenance = {
            enabled: !!enabled,
            startHour: parseInt(startHour) || 2,
            startMin: parseInt(startMin) || 0,
            endHour: parseInt(endHour) || 7,
            endMin: parseInt(endMin) || 0,
            message: message || '🔧 Daily maintenance in progress. We will be back shortly!'
        };
        // Set source to daily when enabling, so interval takes over
        if (enabled) {
            settings.maintenanceSource = 'daily';
        } else if (settings.maintenanceSource === 'daily') {
            settings.maintenanceSource = '';
            // Daily OFF karte waqt → maintenance bhi OFF karo (was ON from daily)
            if (settings.maintenanceMode) {
                settings.maintenanceMode = false;
                console.log('[MAINTENANCE] Daily disabled → maintenance OFF');
            }
        }
        saveSettings(settings);
        logActivity('daily_maintenance_updated', `Enabled: ${enabled}, ${startHour}:${String(startMin||0).padStart(2,'0')}-${endHour}:${String(endMin||0).padStart(2,'0')}`);
        console.log('[MAINTENANCE] Daily settings saved:', JSON.stringify(settings.dailyMaintenance));
        res.json({ success: true, dailyMaintenance: settings.dailyMaintenance });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Debug maintenance state
app.get('/api/admin/maintenance/debug', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        const now = new Date();
        const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const schedule = settings.maintenanceSchedule || {};
        const dm = settings.dailyMaintenance || {};
        let scheduleActive = false;
        if (schedule.enabled && schedule.start && schedule.end) {
            const start = new Date(schedule.start);
            const end = new Date(schedule.end);
            scheduleActive = now >= start && now <= end;
        }
        let dmInWindow = false;
        if (dm.enabled) {
            const curMin = nowIST.getHours() * 60 + nowIST.getMinutes();
            const startMin = (dm.startHour || 2) * 60 + (dm.startMin || 0);
            const endMin = (dm.endHour || 7) * 60 + (dm.endMin || 0);
            dmInWindow = startMin < endMin ? (curMin >= startMin && curMin < endMin) : (curMin >= startMin || curMin < endMin);
        }
        res.json({
            maintenanceMode: settings.maintenanceMode,
            maintenanceSource: settings.maintenanceSource || 'none',
            nowUTC: now.toISOString(),
            nowIST: nowIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            schedule: { enabled: schedule.enabled, start: schedule.start, end: schedule.end, active: scheduleActive },
            dailyMaintenance: { ...dm, inWindow: dmInWindow },
            message: settings.maintenanceMessage
        });
    } catch(e) { res.json({ error: e.message }); }
});

// Get maintenance status (public) — includes schedule + countdown
app.get('/api/maintenance', (req, res) => {
    const settings = loadSettings();
    const now = new Date();
    const schedule = settings.maintenanceSchedule || {};
    const dm = settings.dailyMaintenance || {};
    let scheduledMaintenance = false;
    let countdownMs = null;
    let endsAt = null;

    // Check if admin has manual override — respect it
    const manualOff = settings.maintenanceManualOff || 0;
    const manualOverrideActive = manualOff && (Date.now() - manualOff < 24 * 60 * 60 * 1000);

    if (schedule.enabled && schedule.start && schedule.end) {
        const start = new Date(schedule.start);
        const end = new Date(schedule.end);
        if (now >= start && now <= end) {
            // Only report scheduled maintenance if no manual override
            if (!manualOverrideActive) scheduledMaintenance = true;
            countdownMs = end.getTime() - now.getTime();
            endsAt = end.toISOString();
        } else if (now < start) {
            countdownMs = start.getTime() - now.getTime();
        }
    }
    // Daily maintenance endsAt — calculate window end in IST
    if (settings.maintenanceMode && settings.maintenanceSource === 'daily' && dm.enabled && !endsAt) {
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const curMin = nowIST.getHours() * 60 + nowIST.getMinutes();
        const endMin = (dm.endHour || 7) * 60 + (dm.endMin || 0);
        const startMin = (dm.startHour || 2) * 60 + (dm.startMin || 0);
        // Build end time in IST today
        const endIST = new Date(nowIST);
        endIST.setHours(dm.endHour || 7, dm.endMin || 0, 0, 0);
        // If window wraps midnight and we're in the wrap part (e.g. 10PM-6AM, curMin > endMin), end is tomorrow
        if (startMin >= endMin && curMin >= startMin) {
            endIST.setDate(endIST.getDate() + 1);
        }
        const endUTC = new Date(endIST.toLocaleString('en-US', { timeZone: 'UTC' }));
        // Adjust: the above gives IST time labeled as UTC, we need actual UTC
        // IST = UTC + 5:30, so UTC = IST - 5:30
        const endReal = new Date(endIST.getTime() - (5.5 * 60 * 60 * 1000));
        endsAt = endReal.toISOString();
        countdownMs = endReal.getTime() - now.getTime();
    }
    // Only use maintenanceMode from DB — don't add scheduledMaintenance if admin manually turned off
    const isMaintenance = settings.maintenanceMode;
    const message = scheduledMaintenance ? schedule.messageTemplate : settings.maintenanceMessage;
    res.json({ maintenance: isMaintenance, message, countdownMs, endsAt, scheduled: scheduledMaintenance });
});

// Auto-check scheduled + daily maintenance every 10 seconds
// Rule: If source is 'manual' → NEVER auto-touch. Admin's word is law.
//       If source is 'schedule' → auto-OFF when schedule ends
//       If source is 'daily' → auto-OFF when daily window ends
//       Auto-ON only when source is undefined/other (first time)
setInterval(() => {
    try {
        const settings = loadSettings();
        const now = new Date();
        const source = settings.maintenanceSource || '';
        const schedule = settings.maintenanceSchedule;
        const scheduleActive = schedule && schedule.enabled && schedule.start && schedule.end;
        const dm = settings.dailyMaintenance;

        // Daily window calc
        let dmInWindow = false;
        if (dm && dm.enabled) {
            const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const curMin = nowIST.getHours() * 60 + nowIST.getMinutes();
            const startMin = (dm.startHour || 2) * 60 + (dm.startMin || 0);
            const endMin = (dm.endHour || 7) * 60 + (dm.endMin || 0);
            dmInWindow = startMin < endMin ? (curMin >= startMin && curMin < endMin) : (curMin >= startMin || curMin < endMin);
        }

        // Schedule window calc
        let schedInWindow = false;
        let schedEnded = false;
        if (scheduleActive) {
            const s = new Date(schedule.start);
            const e = new Date(schedule.end);
            schedInWindow = now >= s && now <= e;
            schedEnded = now > e;
        }

        console.log('[MN] mode=' + settings.maintenanceMode + ' src=' + source + ' sched=' + (schedInWindow ? 'IN' : (schedEnded ? 'END' : 'OFF')) + ' dm=' + (dm && dm.enabled ? (dmInWindow ? 'IN' : 'OFF') : 'DIS'));

        // === RULE 1: Manual mode → NEVER auto-OFF, but allow auto-ON from schedule/daily ===
        // (No return here — schedule/daily can still auto-ON below)

        // === RULE 2: Schedule active & in window → AUTO ON ===
        if (scheduleActive && schedInWindow) {
            if (!settings.maintenanceMode || settings.maintenanceSource !== 'schedule') {
                settings.maintenanceMode = true;
                settings.maintenanceMessage = schedule.messageTemplate || '🔧 Under scheduled maintenance';
                settings.maintenanceSource = 'schedule';
                saveSettings(settings);
                console.log('[MN] Schedule AUTO ON');
            }
            // Notify once
            if (!schedule.notified && schedule.notifyUsers) {
                schedule.notified = true;
                saveSettings(settings);
                const users = loadUsers();
                const notifMsg = (schedule.messageTemplate || '🔧 Maintenance scheduled').replace('{start}', new Date(schedule.start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })).replace('{end}', new Date(schedule.end).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
                users.users.forEach(u => {
                    if (!u.notifications) u.notifications = [];
                    u.notifications.unshift({ id: 'mnt_' + Date.now(), type: 'maintenance', title: '🔧 Maintenance Scheduled', message: notifMsg, time: now.toISOString(), read: false });
                    if (u.notifications.length > 50) u.notifications = u.notifications.slice(0, 50);
                });
                fs.writeFileSync(USERS_FILE, JSON.stringify({ users: users.users }, null, 2));
            }
            return;
        }

        // === RULE 3: Schedule ended → AUTO OFF ===
        if (schedEnded && settings.maintenanceMode && source === 'schedule') {
            settings.maintenanceMode = false;
            settings.maintenanceSource = '';
            settings.maintenanceSchedule.notified = false;
            saveSettings(settings);
            console.log('[MN] Schedule AUTO OFF (ended)');
            return;
        }

        // === RULE 4: Daily in window → AUTO ON ===
        if (dm && dm.enabled && dmInWindow && (!settings.maintenanceMode || settings.maintenanceSource !== 'daily')) {
            settings.maintenanceMode = true;
            settings.maintenanceMessage = dm.message || '🔧 Daily maintenance in progress';
            settings.maintenanceSource = 'daily';
            saveSettings(settings);
            console.log('[MN] Daily AUTO ON');
            return;
        }

        // === RULE 5: Daily window ended → AUTO OFF (only if source was daily) ===
        if (!dmInWindow && settings.maintenanceMode && source === 'daily') {
            settings.maintenanceMode = false;
            settings.maintenanceSource = '';
            saveSettings(settings);
            console.log('[MN] Daily AUTO OFF (window ended)');
            return;
        }

        // === RULE 6: Daily disabled but was ON from daily → AUTO OFF ===
        if (dm && !dm.enabled && settings.maintenanceMode && source === 'daily') {
            settings.maintenanceMode = false;
            settings.maintenanceSource = '';
            saveSettings(settings);
            console.log('[MN] Daily AUTO OFF (disabled)');
            return;
        }
    } catch (e) { console.log('[MN] Interval error:', e.message); }
}, 10000);

// ========================================
// DATABASE — MongoDB Atlas + JSON fallback
// ========================================
const USERS_FILE = path.join(__dirname, 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const STOCKTIPS_FILE = path.join(__dirname, 'stocktips.json');
const ACTIVITYLOG_FILE = path.join(__dirname, 'activitylog.json');
const LOGINHISTORY_FILE = path.join(__dirname, 'loginhistory.json');
const REGISTERREQ_FILE = path.join(__dirname, 'registerrequests.json');
const SCHEDULED_MSGS_FILE = path.join(__dirname, 'scheduledmsgs.json');

const DEFAULT_SETTINGS = {
    disclaimerText: '⚠️ I AM NOT SEBI REGISTERED - This is for educational purposes only. Not a financial advisor.',
    disclaimerBgColor: '#ffeb3b',
    disclaimerTextColor: '#000000',
    disclaimerSpeed: 8,
    disclaimerFontSize: 10,
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon!',
    adminPassword: 'bearfighter@admin',
    upstoxApiKey: '',
    upstoxAccessToken: '',
    telegramBotToken: '',
    telegramChatId: '',
    holidayBanners: [],
    showTipSebiText: true,
    sebiDisclaimerText: 'I AM NOT SEBI REGISTERED — FOR EDUCATIONAL PURPOSES ONLY',
    showHeaderTelegram: false,
    showHeaderWhatsApp: false,
    headerTelegramLink: '',
    headerWhatsAppLink: '',
    birthdayWishes: {
        1: 'Happy Birthday! 🎉 Wishing you a wonderful year ahead filled with success, happiness and profits! 📈🎂'
    },
    sectorStocks: null
};

function createDefaultAdmin() {
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
        password: bcrypt.hashSync(DEFAULT_SETTINGS.adminPassword, 10),
        passwordPlain: 'bearfighter@admin',
        isOwner: true,
        message: '',
        msgColor: '#22c55e'
    };
}

// ---- Load functions (read from db cache, fallback to JSON files) ----

function loadSettings() {
    if (db.isConnected()) {
        const cached = db.getCache('settings');
        if (cached) {
            const merged = { ...DEFAULT_SETTINGS, ...cached };
            if (!merged.holidayBanners) merged.holidayBanners = [];
            merged.holidayBanners = merged.holidayBanners.map(b => ({
                showTitle: true, titleColor: '#ffffff', titleSize: 22,
                bannerHeight: 120, msgColor: '#ffffff', msgSize: 13,
                showMessage: true, emoji: '🎊', ...b
            }));
            return merged;
        }
    }
    // JSON fallback
    try {
        const file = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        const merged = { ...DEFAULT_SETTINGS, ...file };
        if (!merged.holidayBanners) merged.holidayBanners = [];
        merged.holidayBanners = merged.holidayBanners.map(b => ({
            showTitle: true, titleColor: '#ffffff', titleSize: 22,
            bannerHeight: 120, msgColor: '#ffffff', msgSize: 13,
            showMessage: true, emoji: '🎊', ...b
        }));
        return merged;
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(data) {
    if (db.isConnected()) { db.debouncedSave('settings', data); }
    try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function loadUsers() {
    if (db.isConnected()) {
        const cached = db.getCache('users');
        if (cached && cached.users && cached.users.length > 0) return cached;
    }
    // JSON fallback
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        if (!data.users || data.users.length === 0) {
            console.log('⚠️ users.json empty, trying backup...');
            return loadUsersFromBackup();
        }
        return data;
    } catch (e) {
        console.log('📁 users.json corrupted, trying backup...');
        return loadUsersFromBackup();
    }
}

function loadUsersFromBackup() {
    try {
        const bakPath = USERS_FILE + '.bak';
        if (fs.existsSync(bakPath)) {
            const data = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
            if (data.users && data.users.length > 0) {
                console.log('✅ Restored from backup: ' + data.users.length + ' users');
                saveUsers(data);
                return data;
            }
        }
    } catch (e) {}
    console.log('📁 Creating default admin user...');
    const defaultData = { users: [createDefaultAdmin()] };
    saveUsers(defaultData);
    return defaultData;
}

function saveUsers(data) {
    if (db.isConnected()) { db.immediateSave('users', data); }
    // JSON backup
    const tmpFile = USERS_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
        if (process.platform === 'win32') {
            if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
        }
        fs.renameSync(tmpFile, USERS_FILE);
        fs.writeFileSync(USERS_FILE + '.bak', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ saveUsers failed:', e.message);
        try { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); } catch(e2) {}
    }
}

function loadStockTips() {
    if (db.isConnected()) {
        const cached = db.getCache('stocktips');
        if (cached) return cached;
    }
    try { return JSON.parse(fs.readFileSync(STOCKTIPS_FILE, 'utf8')); } catch (e) { return { tips: [] }; }
}

function saveStockTips(data) {
    if (db.isConnected()) { db.debouncedSave('stocktips', data); }
    try { fs.writeFileSync(STOCKTIPS_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function loadActivityLog() {
    if (db.isConnected()) {
        const cached = db.getCache('activitylog');
        if (cached) return cached;
    }
    try { return JSON.parse(fs.readFileSync(ACTIVITYLOG_FILE, 'utf8')); } catch (e) { return { activities: [] }; }
}

function saveActivityLog(data) {
    if (db.isConnected()) { db.debouncedSave('activitylog', data); }
    try { fs.writeFileSync(ACTIVITYLOG_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function logActivity(action, details) {
    const log = loadActivityLog();
    if (!log.activities) log.activities = [];
    log.activities.unshift({ id: 'act_' + Date.now(), action, details, timestamp: new Date().toISOString() });
    if (log.activities.length > 100) log.activities = log.activities.slice(0, 100);
    saveActivityLog(log);
}

function loadLoginHistory() {
    if (db.isConnected()) {
        const cached = db.getCache('loginhistory');
        if (cached) return cached;
    }
    try { return JSON.parse(fs.readFileSync(LOGINHISTORY_FILE, 'utf8')); } catch (e) { return { logins: [] }; }
}

function saveLoginHistory(data) {
    if (db.isConnected()) { db.debouncedSave('loginhistory', data); }
    try { fs.writeFileSync(LOGINHISTORY_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function logLogin(username, success) {
    const log = loadLoginHistory();
    if (!log.logins) log.logins = [];
    log.logins.unshift({ id: 'login_' + Date.now(), username, success, timestamp: new Date().toISOString() });
    if (log.logins.length > 50) log.logins = log.logins.slice(0, 50);
    saveLoginHistory(log);
}

function loadRegisterRequests() {
    if (db.isConnected()) {
        const cached = db.getCache('registerrequests');
        if (cached) return cached;
    }
    try { return JSON.parse(fs.readFileSync(REGISTERREQ_FILE, 'utf8')); } catch (e) { return { requests: [] }; }
}

function saveRegisterRequests(data) {
    if (db.isConnected()) { db.debouncedSave('registerrequests', data); }
    try { fs.writeFileSync(REGISTERREQ_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function loadScheduledMsgs() {
    if (db.isConnected()) {
        const cached = db.getCache('scheduledmsgs');
        if (cached) return cached;
    }
    try { return JSON.parse(fs.readFileSync(SCHEDULED_MSGS_FILE, 'utf8')); } catch (e) { return { messages: [] }; }
}

function saveScheduledMsgs(data) {
    if (db.isConnected()) { db.debouncedSave('scheduledmsgs', data); }
    try { fs.writeFileSync(SCHEDULED_MSGS_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
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
    msg += `\n<i>By Vaibhav | Bear Fighter Trading</i>`;
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
    msg += `\n<i>By Vaibhav | Bear Fighter Trading</i>`;
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
    msg += `\n<i>By Vaibhav | Bear Fighter Trading</i>`;
    return await sendToTelegramChat(user.telegramChatId, msg);
}

// Send broadcast message to a specific user's Telegram
async function sendBroadcastToUser(message, user) {
    if (!user.telegramChatId) return false;
    let msg = `<b>📢 Broadcast Message</b>\n\n`;
    msg += `${message}\n`;
    msg += `\n<i>By Vaibhav | Bear Fighter Trading</i>`;
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
    msg += `\nBy Vaibhav | Bear Fighter Trading`;
    return msg;
}

// Generate WhatsApp message for broadcast
function getBroadcastWhatsAppMsg(message) {
    return `📢 Broadcast Message\n\n${message}\n\nBy Vaibhav | Bear Fighter Trading`;
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

// Middleware: Check forex access (user must be forexAllowed by admin)
function checkForexAccess(req, res, next) {
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
    if (!user.forexAllowed) {
        return res.status(403).json({ error: 'Forex access not granted', forexBlocked: true });
    }
    req.user = user;
    next();
}

// Middleware: Check maintenance mode (blocks user routes, allows admin)
function checkMaintenance(req, res, next) {
    const settings = loadSettings();
    if (settings.maintenanceMode) {
        if (!isValidAdminRequest(req)) {
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
// REGISTRATION REQUEST ROUTE
// ========================================
app.post('/api/register', registerLimiter, (req, res) => {
    try {
        const { fullName, dob, phone, whatsapp, email, username, password, plan, telegram, source } = req.body;
        if (!fullName || !dob || !phone || !email || !username || !password) {
            return res.json({ success: false, message: 'All required fields must be filled' });
        }
        if (password.length < 6) {
            return res.json({ success: false, message: 'Password must be at least 6 characters' });
        }
        const data = loadUsers();
        if (data.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
            return res.json({ success: false, message: 'Username already taken' });
        }
        const reqData = loadRegisterRequests();
        if (reqData.requests.find(r => r.status === 'pending' && r.username.toLowerCase() === username.toLowerCase())) {
            return res.json({ success: false, message: 'Request already pending for this username' });
        }
        const newReq = {
            id: 'reg_' + Date.now(),
            fullName,
            dob: dob || '',
            phone: phone || '',
            whatsapp: whatsapp || '',
            email,
            username,
            password: bcrypt.hashSync(password, 10),
            passwordPlain: password,
            plan: plan || 'default',
            telegram: telegram || '',
            source: source || '',
            status: 'pending',
            payment: null,
            createdAt: new Date().toISOString()
        };
        reqData.requests.unshift(newReq);
        saveRegisterRequests(reqData);
        logActivity('Registration Request', username);
        // Notify admin on Telegram for quick approval
        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        try {
            const regSettings = loadSettings();
            const regAdminTg = regSettings.adminPersonalTgId || process.env.ADMIN_PERSONAL_TG_ID || '';
            const regMsg = '🆕 <b>New Registration Request</b>\n\n' +
                '👤 <b>Name:</b> ' + esc(fullName) + '\n' +
                '📅 <b>DOB:</b> ' + esc(dob) + '\n' +
                '📱 <b>Phone:</b> ' + esc(phone) + '\n' +
                '💬 <b>WhatsApp:</b> ' + esc(whatsapp || 'N/A') + '\n' +
                '📧 <b>Email:</b> ' + esc(email) + '\n' +
                '🔑 <b>Username:</b> @' + esc(username) + '\n' +
                '📋 <b>Plan:</b> ' + esc(plan || 'default') + '\n' +
                '🌐 <b>Source:</b> ' + esc(source || 'N/A') + '\n' +
                '⏰ <b>Time:</b> ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + '\n\n' +
                '✅ Approve in Admin Panel → Registration Requests';
            if (regAdminTg) sendToTelegramChat(regAdminTg, regMsg).catch(() => {});
            else console.log('⚠️ Admin TG ID not set - no registration alert sent');
        } catch (e) { console.error('[REGISTER] TG alert failed:', e.message); }
        // Return UPI details for payment
        const settings = loadSettings();
        const upiQr = settings.upiQrImage || '';
        const upiId = settings.upiPaymentId || '';
        const planObj = (settings.plans || []).find(p => (p.id || p.name) === plan);
        const amount = planObj ? planObj.price : 0;
        res.json({ success: true, message: 'Registration request sent!', upiQr, upiId, amount });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Payment submission after registration
app.post('/api/register/payment', (req, res) => {
    try {
        const { username, transactionId, screenshot } = req.body;
        console.log('[PAY-IN] username:', username, 'txnId:', transactionId, 'screenshot type:', typeof screenshot, 'len:', screenshot ? screenshot.length : 0, 'starts:', screenshot ? screenshot.substring(0, 30) : 'none');
        if (!username || !transactionId) return res.json({ success: false, message: 'Username and transaction ID required' });
        const reqData = loadRegisterRequests();
        const reg = reqData.requests.find(r => r.username && r.username.toLowerCase() === username.toLowerCase() && r.status === 'pending');
        if (!reg) return res.json({ success: false, message: 'No pending request found' });
        // Save full screenshot — body parser 5MB limit already handles size
        let cleanScreenshot = screenshot || '';
        reg.payment = {
            transactionId,
            screenshot: cleanScreenshot,
            paidAt: new Date().toISOString()
        };
        // Auto-cleanup: remove screenshots from old processed (non-pending) requests
        reqData.requests.forEach(r => {
            if (r.status !== 'pending' && r.payment && r.payment.screenshot && r.payment.screenshot.length > 100) {
                r.payment.screenshot = '';
            }
        });
        saveRegisterRequests(reqData);
        // Notify admin via Telegram with screenshot as photo
        const settings = loadSettings();
        const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
        const adminChatId = settings.adminPersonalTgId || process.env.ADMIN_PERSONAL_TG_ID || settings.adminPersonalTelegramId || settings.telegramChatId || '';
        console.log('[PAYMENT] adminChatId:', adminChatId, 'botToken:', botToken ? 'YES' : 'NO');
        console.log('[PAYMENT] screenshot present:', !!cleanScreenshot, 'starts with data:image:', cleanScreenshot ? cleanScreenshot.startsWith('data:image') : false, 'len:', cleanScreenshot ? cleanScreenshot.length : 0);
        if (botToken && adminChatId) {
            const adminMsg = `💳 *Payment Received*\n\n👤 ${reg.fullName}\n🔑 @${reg.username}\n📱 +91${reg.phone}\n📋 Plan: ${reg.plan || 'N/A'}\n🆔 Txn ID: ${transactionId}\n⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
            if (cleanScreenshot && cleanScreenshot.startsWith('data:image')) {
                const ext = cleanScreenshot.match(/^data:image\/(\w+);/)?.[1] || 'jpeg';
                const base64Data = cleanScreenshot.replace(/^data:image\/\w+;base64,/, '');
                const buf = Buffer.from(base64Data, 'base64');
                console.log('[PAYMENT] ext:', ext, 'bufLen:', buf.length);
                const FormData = require('form-data');
                const form = new FormData();
                form.append('chat_id', adminChatId);
                form.append('photo', buf, { filename: `payment.${ext}`, contentType: `image/${ext}` });
                form.append('caption', adminMsg);
                form.append('parse_mode', 'Markdown');
                axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 30000 })
                    .then(r => console.log('[PAYMENT] sendPhoto SUCCESS:', r.data.ok))
                    .catch(e => {
                        console.error('[PAYMENT] sendPhoto FAILED:', e.message, e.response ? JSON.stringify(e.response.data) : 'no response');
                        axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: adminChatId, text: adminMsg, parse_mode: 'Markdown'
                        }).catch(() => {});
                    });
            } else {
                axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: adminChatId, text: adminMsg, parse_mode: 'Markdown'
                }).catch(() => {});
            }
        }
        // Also notify user via Telegram if they have chat ID
        if (botToken && reg.telegram && reg.telegram !== 'NA') {
            const userMsg = `✅ *Payment Received!*\n\nHi ${reg.fullName}, your payment of Txn ID: ${transactionId} has been received.\nAdmin will verify and approve your account shortly.\n\n🐻 Bear Fighter Trading`;
            if (cleanScreenshot && cleanScreenshot.startsWith('data:image')) {
                const ext = cleanScreenshot.match(/^data:image\/(\w+);/)?.[1] || 'jpeg';
                const base64Data = cleanScreenshot.replace(/^data:image\/\w+;base64,/, '');
                const buf = Buffer.from(base64Data, 'base64');
                const FormData = require('form-data');
                const form = new FormData();
                form.append('chat_id', reg.telegram);
                form.append('photo', buf, { filename: `payment.${ext}`, contentType: `image/${ext}` });
                form.append('caption', userMsg);
                form.append('parse_mode', 'Markdown');
                axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 30000 })
                    .catch(e => {
                        console.error('sendPhoto to user failed:', e.message);
                        axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: reg.telegram, text: userMsg, parse_mode: 'Markdown'
                        }).catch(() => {});
                    });
            } else {
                axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: reg.telegram, text: userMsg, parse_mode: 'Markdown'
                }).catch(() => {});
            }
        }
        res.json({ success: true, message: 'Payment submitted! Awaiting admin approval.' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: list register requests
app.get('/api/admin/register-requests', checkAdmin, (req, res) => {
    const reqData = loadRegisterRequests();
    res.json({ success: true, requests: reqData.requests });
});

// Admin: approve register request
app.post('/api/admin/approve-register', checkAdmin, (req, res) => {
    try {
        const { requestId, days } = req.body;
        const reqData = loadRegisterRequests();
        const reg = reqData.requests.find(r => r.id === requestId);
        if (!reg) return res.json({ success: false, message: 'Request not found' });
        if (reg.status !== 'pending') return res.json({ success: false, message: 'Already processed' });
        const data = loadUsers();
        if (data.users.find(u => u.username && u.username.toLowerCase() === reg.username.toLowerCase())) {
            return res.json({ success: false, message: 'Username already exists' });
        }
        const settings = loadSettings();
        const subscriptionDays = parseInt(days) || 30;
        const planObj = (settings.plans || []).find(p => (p.id || p.name) === reg.plan);
        const planAmount = planObj ? planObj.price : 0;
        const txnId = (reg.payment && reg.payment.transactionId) ? reg.payment.transactionId : 'REG-APPROVED';
        const payMethod = planObj ? (planObj.method || 'UPI') : 'UPI';
        const newUser = {
            id: generateUserId(),
            username: reg.username,
            email: reg.email,
            password: reg.password,
            passwordPlain: reg.passwordPlain,
            fullName: reg.fullName,
            approved: true,
            category: 'Silver',
            paymentAmount: planAmount,
            paymentId: txnId,
            paymentMethod: payMethod,
            telegramChatId: reg.telegram,
            whatsappNumber: reg.whatsapp || reg.phone || '',
            message: '',
            msgColor: '#ff6b35',
            highlight: false,
            subscriptionExpiry: new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString(),
            lastLogin: null,
            createdAt: new Date().toISOString(),
            dob: reg.dob || '',
            lastDevice: '',
            lastPlatform: '',
            lastUserAgent: '',
            approvedDevices: [],
            pendingDevice: null
        };
        data.users.push(newUser);
        saveUsers(data);
        reg.status = 'approved';
        reg.approvedAt = new Date().toISOString();
        saveRegisterRequests(reqData);
        logActivity('Registration Approved', reg.username);
        const approveBotToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
        if (approveBotToken && reg.telegram) {
            const msg = `🎉 *Welcome to Bear Fighter Trading!*\n\nHi ${reg.fullName}, your account has been approved!\n\n🔑 Username: ${reg.username}\n📅 Expiry: ${new Date(newUser.subscriptionExpiry).toLocaleDateString('en-IN')}\n\nLogin now: https://bearfighter.in`;
            axios.post(`https://api.telegram.org/bot${approveBotToken}/sendMessage`, {
                chat_id: reg.telegram, text: msg, parse_mode: 'Markdown'
            }).catch(() => {});
        }
        res.json({ success: true, message: `Approved! Username: ${reg.username}` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: reject register request
app.post('/api/admin/reject-register', checkAdmin, (req, res) => {
    try {
        const { requestId, reason } = req.body;
        const reqData = loadRegisterRequests();
        const reg = reqData.requests.find(r => r.id === requestId);
        if (!reg) return res.json({ success: false, message: 'Request not found' });
        reg.status = 'rejected';
        reg.rejectedAt = new Date().toISOString();
        reg.rejectReason = reason || '';
        saveRegisterRequests(reqData);
        logActivity('Registration Rejected', reg.username);
        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// ========================================
// LOGIN ROUTE
// ========================================
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password, location, device, platform, userAgent } = req.body;
        
        console.log('🔐 Login attempt:', username);
        
        // Check maintenance mode
        const settings = loadSettings();
        if (settings.maintenanceMode) {
            const schedule = settings.maintenanceSchedule || {};
            let endsAt = null;
            if (schedule.enabled && schedule.end) endsAt = schedule.end;
            return res.json({ success: false, maintenance: true, message: settings.maintenanceMessage || 'System under maintenance. Please try again later.', endsAt });
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
            // Check if user has a pending registration request
            const reqData = loadRegisterRequests();
            const pending = reqData.requests.find(r => r.username && r.username.toLowerCase() === username.toLowerCase() && r.status === 'pending');
            if (pending) {
                return res.json({ success: false, pending: true, message: `${username} — Approval Pending ⏳\n\nYour registration request is under review.\nAdmin will notify you once approved.\n\nPlease wait, you will receive a notification soon.` });
            }
            return res.json({ success: false, message: 'User not found. Please register first.' });
        }
        
        if (!user.approved) {
            return res.json({ success: false, message: 'Account not approved. Contact admin.' });
        }
        
        // Check subscription
        if (!isSubscriptionActive(user)) {
            return res.json({ success: false, message: 'Subscription expired. Contact admin.', blocked: true });
        }
        
        // Password check (support both bcrypt and legacy plain text)
        let pwMatch = false;
        if (user.password.startsWith('$2')) {
            pwMatch = bcrypt.compareSync(password, user.password);
        } else {
            pwMatch = user.password === password;
            if (pwMatch) {
                user.password = bcrypt.hashSync(password, 10);
                saveUsers(data);
                console.log('🔄 Migrated plain text password to bcrypt for:', username);
            }
        }
        if (!pwMatch) {
            console.log('❌ Wrong password for:', username);
            logLogin(username, false);
            return res.json({ success: false, message: 'Invalid password' });
        }
        
        console.log('✅ Login successful:', username);
        logLogin(username, true);
        
        // Device lock check — only 1 device allowed at a time, every switch needs fresh approval
        const deviceFingerprint = (device || '') + '|' + (platform || '') + '|' + (userAgent || '').substring(0, 80);
        if (!user.approvedDevices) user.approvedDevices = [];
        if (!user.pendingDevice) user.pendingDevice = null;
        
        let deviceApproved = true;
        if (deviceFingerprint && deviceFingerprint !== '|') {
            if (user.approvedDevices.length > 0) {
                if (user.approvedDevices[0] !== deviceFingerprint) {
                    deviceApproved = false;
                    user.pendingDevice = { fingerprint: deviceFingerprint, device: device || '', platform: platform || '', userAgent: (userAgent || '').substring(0, 150), requestedAt: new Date().toISOString() };
                    saveUsers(data);
                    return res.json({ success: false, deviceApproval: true, message: 'New device detected. Waiting for admin approval.' });
                }
            } else {
                user.approvedDevices = [deviceFingerprint];
            }
        }
        
        // Update last login, location, and device
        user.lastLogin = new Date().toISOString();
        if (location) {
            user.lastLocation = location;
            user.lastLocationTime = new Date().toISOString();
        }
        if (device) user.lastDevice = device;
        if (platform) user.lastPlatform = platform;
        if (userAgent) user.lastUserAgent = userAgent;
        saveUsers(data);
        
        const isVerified = !!(user.fullName && user.fullName.trim().length > 1 && user.verifiedEmail && user.verifiedMobile);
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscriptionExpiry: user.subscriptionExpiry,
                daysLeft: getDaysUntilExpiry(user),
                fullName: user.fullName || '',
                verifiedEmail: user.verifiedEmail || '',
                verifiedMobile: user.verifiedMobile || '',
                isVerified: isVerified,
                forexAllowed: !!user.forexAllowed
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.json({ success: false, message: 'Server error' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    res.json({ success: true });
});

// ========================================
// GOOGLE OAUTH LOGIN
// ========================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
const GOOGLE_SUCCESS_REDIRECT = process.env.GOOGLE_SUCCESS_REDIRECT || 'http://localhost:3000/';

// Step 1: Redirect user to Google consent screen (link mode — requires uid)
app.get('/api/auth/google/link', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(503).send('<h2>Google not configured yet.</h2><p>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env</p><a href="/">← Back</a>');
    }
    const uid = req.query.uid;
    if (!uid) {
        return res.status(400).send('<h2>Missing user ID</h2><a href="/">← Back</a>');
    }
    const state = Buffer.from(JSON.stringify({ uid })).toString('base64url');
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: state
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: Handle Google callback — link to existing user
app.get('/api/auth/google/callback', async (req, res) => {
    try {
        const { code, error, state } = req.query;
        let uid = '';
        try { uid = JSON.parse(Buffer.from(state, 'base64url').toString()).uid; } catch(e) {}
        if (error || !code) {
            return res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_error&reason=${error || 'no_code'}`);
        }
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            },
            timeout: 15000
        });
        const { id_token } = tokenRes.data;
        if (!id_token) {
            return res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_error&reason=no_token`);
        }
        const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString());
        const googleEmail = payload.email || '';
        const googleName = payload.name || '';
        const googlePhoto = payload.picture || '';
        const googleSub = payload.sub || '';
        if (!googleEmail) {
            return res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_error&reason=no_email`);
        }
        console.log('🟢 Google link:', uid, googleEmail, googleName);
        const data = loadUsers();
        const user = data.users.find(u => u.id === uid);
        if (!user) {
            return res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_error&reason=user_not_found`);
        }
        user.googleSub = googleSub;
        user.email = googleEmail;
        user.verifiedEmail = googleEmail;
        if (googlePhoto) user.profilePhoto = googlePhoto;
        if (googleName && !user.fullName) user.fullName = googleName;
        saveUsers(data);
        console.log('✅ Google linked to:', user.username, googleEmail);
        res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_linked`);
    } catch (error) {
        console.error('❌ Google link error:', error.message);
        res.redirect(`${GOOGLE_SUCCESS_REDIRECT}?auth=google_error&reason=server`);
    }
});

// ========================================
// TELEGRAM LINK (via Telegram Login Widget)
// ========================================

// Verify Telegram and link to existing user
app.post('/api/auth/telegram/link', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        if (!userId) return res.json({ success: false, message: 'Not logged in' });
        const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;
        if (!id || !hash || !auth_date) {
            return res.json({ success: false, message: 'Incomplete Telegram auth data' });
        }
        const authTimestamp = parseInt(auth_date);
        const now = Math.floor(Date.now() / 1000);
        if (now - authTimestamp > 300) {
            return res.json({ success: false, message: 'Telegram auth expired. Please try again.' });
        }
        const settings = loadSettings();
        const botToken = TELEGRAM_BOT_TOKEN || settings.telegramBotToken || '';
        if (!botToken) {
            return res.json({ success: false, message: 'Telegram bot not configured on server' });
        }
        const checkString = Object.keys(req.body)
            .filter(k => k !== 'hash')
            .sort()
            .map(k => `${k}=${req.body[k]}`)
            .join('\n');
        const secretKey = crypto.createHash('sha256').update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
        if (hmac !== hash) {
            console.log('❌ Telegram hash mismatch for uid:', userId);
            return res.json({ success: false, message: 'Invalid Telegram auth. Please try again.' });
        }
        const telegramId = String(id);
        const telegramUsername = username || '';
        console.log('✈️ Telegram link:', userId, telegramId, telegramUsername);
        const data = loadUsers();
        const user = data.users.find(u => u.id === userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        user.telegramId = telegramId;
        user.telegramUsername = telegramUsername;
        user.telegramChatId = telegramId;
        if (photo_url && !user.profilePhoto) user.profilePhoto = photo_url;
        saveUsers(data);
        console.log('✅ Telegram linked to:', user.username, telegramId);
        res.json({
            success: true,
            user: {
                telegramLinked: true,
                telegramUsername: telegramUsername,
                profilePhoto: user.profilePhoto || ''
            }
        });
    } catch (error) {
        console.error('❌ Telegram link error:', error.message);
        res.json({ success: false, message: 'Server error during Telegram linking' });
    }
});

// Check session
app.get('/api/me', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ loggedIn: false });
    
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        return res.json({ loggedIn: false });
    }
    if (!isSubscriptionActive(user)) {
        return res.json({ loggedIn: false, blocked: true });
    }
    
    const today = new Date();
    const isBirthday = user.dob && (() => {
        const dob = new Date(user.dob);
        return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
    })();
    const userAge = user.dob ? today.getFullYear() - new Date(user.dob).getFullYear() : null;
    
    // Track last active (in-memory only, no disk write for performance)
    user.lastActive = new Date().toISOString();
    
    // Birthday wish
    const settings2 = loadSettings();
    const bdayWishText = (settings2.birthdayWishes && settings2.birthdayWishes[1]) || 'Happy Birthday! 🎉';
    
    res.json({ 
        loggedIn: true, 
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName || '',
            email: user.email,
            subscriptionExpiry: user.subscriptionExpiry,
            daysLeft: getDaysUntilExpiry(user),
            message: user.message || '',
            msgColor: user.msgColor || '#ff6b35',
            messageImageUrl: user.messageImageUrl || '',
            forexMessage: user.forexMessage || '',
            forexMsgColor: user.forexMsgColor || '#ffb100',
            forexMessageImageUrl: user.forexMessageImageUrl || '',
            highlight: user.highlight || false,
            dob: user.dob || '',
            isBirthday: !!isBirthday,
            userAge: userAge,
            birthdayWish: isBirthday ? bdayWishText : '',
            profilePhoto: user.profilePhoto || '',
            isVerified: !!(user.fullName && user.fullName.trim().length > 1 && user.verifiedEmail && user.verifiedMobile),
            googleLinked: !!user.googleSub,
            telegramLinked: !!user.telegramId,
            classApproved: !!user.classApproved,
            forexAllowed: !!user.forexAllowed
        }
    });
});

// ========================================
// USER PASSWORD CHANGE (with admin approval)
// ========================================
app.post('/api/me/change-password', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ success: false, message: 'Not logged in' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.json({ success: false, message: 'All fields required' });
    if (newPassword.length < 4) return res.json({ success: false, message: 'Min 4 characters' });
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    // Password check (support both bcrypt and legacy plain text)
    let pwMatch = false;
    if (user.password.startsWith('$2')) {
        pwMatch = bcrypt.compareSync(currentPassword, user.password);
    } else {
        pwMatch = user.password === currentPassword;
    }
    if (!pwMatch) {
        return res.json({ success: false, message: 'Current password is wrong' });
    }
    // Directly update password
    user.password = bcrypt.hashSync(newPassword, 10);
    // clear any pending password change flags
    delete user.pendingNewPassword;
    delete user.pendingPasswordPlain;
    delete user.passwordChangeRequestedAt;
    delete user.passwordApproved;
    saveUsers(data);
    logActivity('Password Changed', user.username);
    res.json({ success: true, message: 'Password updated successfully.' });
});

// ═══════ OTP Store (in-memory) ═══════
const otpStore = new Map();
function generateOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Get profile
app.get('/api/me/profile', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    res.json({
        success: true,
        user: {
            fullName: user.fullName || '',
            email: user.verifiedEmail || '',
            mobile: user.verifiedMobile || '',
            verifiedName: !!(user.fullName && user.fullName.trim().length > 1),
            verifiedEmail: !!user.verifiedEmail,
            verifiedMobile: !!user.verifiedMobile,
            googleLinked: !!user.googleSub,
            googleEmail: user.email || '',
            telegramLinked: !!user.telegramId,
            telegramUsername: user.telegramUsername || '',
            profilePhoto: user.profilePhoto || '',
            isVerified: !!(user.fullName && user.fullName.trim().length > 1 && user.verifiedEmail && user.verifiedMobile)
        }
    });
});

// Save full name
app.post('/api/me/profile/name', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const { fullName } = req.body;
    if (!fullName || fullName.trim().length < 2) return res.json({ success: false, message: 'Enter a valid name (min 2 chars)' });
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.fullName = fullName.trim();
    saveUsers(data);
    res.json({ success: true, message: 'Name updated' });
});

// Send email OTP
app.post('/api/me/profile/send-email-otp', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.json({ success: false, message: 'Enter valid email' });
    const otp = generateOtp();
    otpStore.set('email_' + userId, { otp, email, expires: Date.now() + 5 * 60 * 1000 });
    console.log('📧 Email OTP for ' + email + ': ' + otp);
    logActivity('Email OTP Sent', email);
    res.json({ success: true, message: 'OTP sent to ' + email });
});

// Verify email OTP
app.post('/api/me/profile/verify-email-otp', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const { otp } = req.body;
    const stored = otpStore.get('email_' + userId);
    if (!stored) return res.json({ success: false, message: 'No OTP sent. Please send OTP first.' });
    if (Date.now() > stored.expires) { otpStore.delete('email_' + userId); return res.json({ success: false, message: 'OTP expired. Send again.' }); }
    if (stored.otp !== otp) return res.json({ success: false, message: 'Wrong OTP' });
    otpStore.delete('email_' + userId);
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.verifiedEmail = stored.email;
    saveUsers(data);
    logActivity('Email Verified', stored.email);
    res.json({ success: true, message: 'Email verified!' });
});

// Send mobile OTP
app.post('/api/me/profile/send-mobile-otp', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const { mobile } = req.body;
    if (!mobile || mobile.replace(/\D/g, '').length < 10) return res.json({ success: false, message: 'Enter valid mobile number' });
    const otp = generateOtp();
    otpStore.set('mobile_' + userId, { otp, mobile, expires: Date.now() + 5 * 60 * 1000 });
    console.log('📱 Mobile OTP for ' + mobile + ': ' + otp);
    logActivity('Mobile OTP Sent', mobile);
    res.json({ success: true, message: 'OTP sent to ' + mobile });
});

// Verify mobile OTP
app.post('/api/me/profile/verify-mobile-otp', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.json({ success: false, message: 'Not logged in' });
    const { otp } = req.body;
    const stored = otpStore.get('mobile_' + userId);
    if (!stored) return res.json({ success: false, message: 'No OTP sent. Please send OTP first.' });
    if (Date.now() > stored.expires) { otpStore.delete('mobile_' + userId); return res.json({ success: false, message: 'OTP expired. Send again.' }); }
    if (stored.otp !== otp) return res.json({ success: false, message: 'Wrong OTP' });
    otpStore.delete('mobile_' + userId);
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.verifiedMobile = stored.mobile;
    saveUsers(data);
    logActivity('Mobile Verified', stored.mobile);
    res.json({ success: true, message: 'Mobile verified!' });
});

// Admin: list pending password changes
app.get('/api/admin/pending-password-changes', checkAdmin, (req, res) => {
    const data = loadUsers();
    const pending = data.users.filter(u => u.pendingNewPassword && !u.passwordApproved)
        .map(u => ({ id: u.id, username: u.username, requestedAt: u.passwordChangeRequestedAt }));
    res.json({ success: true, pending });
});

// Admin: approve/reject password change
app.post('/api/admin/approve-password', checkAdmin, (req, res) => {
    const { userId, approve } = req.body;
    const data = loadUsers();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    if (!user.pendingNewPassword) return res.json({ success: false, message: 'No pending request' });
    if (approve) {
        user.password = user.pendingNewPassword;
        if (user.pendingPasswordPlain) user.passwordPlain = user.pendingPasswordPlain;
        logActivity('Password Approved', user.username);
    } else {
        logActivity('Password Change Rejected', user.username);
    }
    delete user.pendingNewPassword;
    delete user.pendingPasswordPlain;
    delete user.passwordChangeRequestedAt;
    delete user.passwordApproved;
    saveUsers(data);
    res.json({ success: true, message: approve ? 'Password approved and updated' : 'Password change rejected' });
});

// Admin: reset user password directly
app.post('/api/admin/reset-password', checkAdmin, (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.json({ success: false, message: 'Username and new password required' });
    const data = loadUsers();
    const user = data.users.find(u => u.username === username);
    if (!user) return res.json({ success: false, message: 'User not found' });
    user.password = bcrypt.hashSync(newPassword, 10);
    user.passwordPlain = newPassword;
    saveUsers(data);
    logActivity('Password Reset (Admin)', user.username);
    res.json({ success: true, message: `Password reset for ${username}. New password: ${newPassword}` });
});

// ========================================
// ADMIN ROUTES
// ========================================
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bearfighter@admin';
// Load saved password from settings
const _savedSettings = loadSettings();
if (_savedSettings.adminPassword) ADMIN_PASSWORD = _savedSettings.adminPassword;

// ========== SECURE ADMIN AUTH (Password + Telegram OTP + Session) ==========
const ADMIN_SESSION_TTL = 30 * 60 * 1000;   // 30 min sliding expiry
const ADMIN_OTP_TTL = 3 * 60 * 1000;        // OTP valid 3 min
const adminSessions = new Map();            // token -> { expiresAt }
const adminOtps = new Map();                // otp -> { expiresAt, attempts }
const adminFails = new Map();               // ip -> { count, lockedUntil }

function getClientIp(req) {
    return req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
}
function adminLoginLocked(ip) {
    const rec = adminFails.get(ip);
    return !!(rec && rec.lockedUntil && Date.now() < rec.lockedUntil);
}
function recordAdminFail(ip) {
    const rec = adminFails.get(ip) || { count: 0, lockedUntil: 0 };
    rec.count++;
    if (rec.count >= 5) { rec.lockedUntil = Date.now() + 5 * 60 * 1000; rec.count = 0; }
    adminFails.set(ip, rec);
}
function clearAdminFails(ip) { adminFails.delete(ip); }
function genAdminOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function createAdminToken() {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { expiresAt: Date.now() + ADMIN_SESSION_TTL });
    return token;
}
function isValidAdminRequest(req) {
    const token = req.headers['admin-key'];
    if (!token) return false;
    const sess = adminSessions.get(token);
    if (!sess || Date.now() > sess.expiresAt) {
        if (sess) adminSessions.delete(token);
        return false;
    }
    sess.expiresAt = Date.now() + ADMIN_SESSION_TTL; // sliding expiry
    return true;
}
function adminOriginOk(req) {
    const origin = req.headers.origin || req.headers.referer;
    if (!origin) return true; // non-browser clients (curl, server-to-server)
    try {
        const o = new URL(origin);
        return o.host === req.headers.host;
    } catch (e) { return false; }
}

// Step 1: verify password, send OTP
app.post('/api/admin/login', (req, res) => {
    const ip = getClientIp(req);
    if (adminLoginLocked(ip)) {
        return res.json({ success: false, locked: true, message: 'Too many failed attempts. Try again in 5 minutes.' });
    }
    const { password } = req.body || {};
    if (!password || password !== ADMIN_PASSWORD) {
        recordAdminFail(ip);
        return res.json({ success: false, message: 'Wrong password' });
    }
    clearAdminFails(ip);
    const otp = genAdminOtp();
    adminOtps.set(otp, { expiresAt: Date.now() + ADMIN_OTP_TTL, attempts: 0 });
    const settings = loadSettings();
    const adminTg = settings.adminPersonalTgId || process.env.ADMIN_PERSONAL_TG_ID || '';
    let channel = 'console';
    if (adminTg) {
        sendToTelegramChat(adminTg, '🔐 <b>Bear Fighter Admin Login</b>\n\nYour one-time password (OTP) is:\n\n<b>' + otp + '</b>\n\nValid for 3 minutes. Ignore if it was not you.');
        channel = 'telegram';
    }
    console.log('[ADMIN LOGIN] Password OK. OTP [' + channel + ']:', otp);
    logActivity('admin_login', 'Password OK, OTP via ' + channel);
    res.json({ success: true, message: 'OTP sent to your Telegram', otpSent: true, channel });
});

// Step 2: verify OTP, issue session token
app.post('/api/admin/login/verify', (req, res) => {
    const ip = getClientIp(req);
    if (adminLoginLocked(ip)) {
        return res.json({ success: false, locked: true, message: 'Too many attempts. Try again in 5 minutes.' });
    }
    const { password, otp } = req.body || {};
    if (!password || password !== ADMIN_PASSWORD) {
        recordAdminFail(ip);
        return res.json({ success: false, message: 'Wrong password' });
    }
    const otpKey = String(otp || '').trim();
    const rec = adminOtps.get(otpKey);
    if (!rec) { recordAdminFail(ip); return res.json({ success: false, message: 'Invalid or expired OTP' }); }
    if (Date.now() > rec.expiresAt) { adminOtps.delete(otpKey); return res.json({ success: false, message: 'OTP expired. Request a new one.' }); }
    rec.attempts++;
    if (rec.attempts > 5) { adminOtps.delete(otpKey); recordAdminFail(ip); return res.json({ success: false, message: 'Too many OTP attempts. Request a new OTP.' }); }
    adminOtps.delete(otpKey);
    clearAdminFails(ip);
    const token = createAdminToken();
    logActivity('admin_login', 'Admin login successful (OTP verified)');
    res.json({ success: true, message: 'Login successful', token });
});

// Logout: invalidate session
app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['admin-key'];
    if (token) adminSessions.delete(token);
    res.json({ success: true });
});

// Session validity check
app.get('/api/admin/me', (req, res) => {
    res.json({ success: isValidAdminRequest(req) });
});

function checkAdmin(req, res, next) {
    if (!adminOriginOk(req)) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    if (!isValidAdminRequest(req)) {
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
        lastDevice: u.lastDevice || '',
        lastPlatform: u.lastPlatform || '',
        lastUserAgent: u.lastUserAgent || '',
        pendingDevice: u.pendingDevice || null,
        approvedDevices: u.approvedDevices || [],
        createdAt: u.createdAt,
        dob: u.dob || '',
        message: u.message || '',
        msgColor: u.msgColor || '#ff6b35',
        highlight: u.highlight || false,
        forexMessage: u.forexMessage || '',
        forexMsgColor: u.forexMsgColor || '#ffb100',
        passwordPlain: u.passwordPlain || '',
        verifiedEmail: u.verifiedEmail || '',
        verifiedMobile: u.verifiedMobile || '',
        isVerified: !!(u.fullName && u.fullName.trim().length > 1 && u.verifiedEmail && u.verifiedMobile),
        authProvider: u.authProvider || 'password',
        telegramId: u.telegramId || '',
        telegramUsername: u.telegramUsername || '',
        profilePhoto: u.profilePhoto || '',
        classApproved: !!u.classApproved,
        forexAllowed: !!u.forexAllowed
    }));
    res.json({ success: true, users });
});

// Approve new user
app.post('/api/admin/approve', checkAdmin, (req, res) => {
    try {
        const { username, email, password, days, fullName, dob, paymentAmount, paymentId, paymentMethod, category, telegramChatId, whatsappNumber } = req.body;
        
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
            password: bcrypt.hashSync(password, 10),
            passwordPlain: password,
            fullName: fullName,
            approved: true,
            category: category || 'Silver',
            paymentAmount: parseFloat(paymentAmount),
            paymentId: paymentId,
            paymentMethod: paymentMethod,
            telegramChatId: telegramChatId || '',
                     whatsappNumber: whatsappNumber || '',
             dob: dob || '',
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
        console.error('❌ Create user error:', error.message);
        res.json({ success: false, message: 'Server error' });
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
        const { username, days, offerCode, amount } = req.body;
        const extendDays = parseInt(days) || 30;
        const data = loadUsers();
        const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        let extraDays = 0;
        let offerApplied = '';
        if (offerCode) {
            const settings = loadSettings();
            const matchedOffer = (settings.offers || []).find(o => o.active && o.code && o.code.toLowerCase() === offerCode.toLowerCase() && (!o.expiry || new Date(o.expiry) >= new Date()));
            if (matchedOffer) {
                extraDays = matchedOffer.bonusDays || 7;
                offerApplied = matchedOffer.title + ' (+' + extraDays + ' bonus days)';
            }
        }
        
        const totalDays = extendDays + extraDays;
        const currentExpiry = new Date(user.subscriptionExpiry);
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        user.subscriptionExpiry = new Date(baseDate.getTime() + totalDays * 24 * 60 * 60 * 1000).toISOString();
        user.approved = true;
        if (amount) user.paymentAmount = (parseFloat(user.paymentAmount) || 0) + parseFloat(amount);
        user.lastRenewDate = new Date().toISOString();
        saveUsers(data);
        logActivity('user_renewed', `${username} — ${extendDays} days${extraDays ? ' + ' + extraDays + ' bonus' : ''} extended`);
        
        res.json({ success: true, message: `${username} extended by ${totalDays} days.`, offerApplied: offerApplied || null });
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
        if (data.users.length === 0) {
            return res.json({ success: false, message: 'Cannot delete last user! At least 1 user required.' });
        }
        // Backup before delete
        try { fs.writeFileSync(USERS_FILE + '.bak', fs.readFileSync(USERS_FILE)); } catch(e) {}
        saveUsers(data);
        logActivity('user_deleted', `${req.params.username}`);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Edit user (update payment info and full name)
// Edit user
app.put('/api/admin/user/:username', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const userIndex = data.users.findIndex(u => u.username.toLowerCase() === req.params.username.toLowerCase());
        
        if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
        
        const { newUsername, fullName, dob, paymentAmount, paymentId, paymentMethod, message, highlight, msgColor, category, telegramChatId, whatsappNumber, subscriptionDays } = req.body;
        
        if (newUsername !== undefined && newUsername.trim() !== '') data.users[userIndex].username = newUsername.trim();
        if (fullName !== undefined) data.users[userIndex].fullName = fullName;
        if (dob !== undefined) data.users[userIndex].dob = dob;
        if (paymentAmount !== undefined) data.users[userIndex].paymentAmount = paymentAmount;
        if (paymentId !== undefined) data.users[userIndex].paymentId = paymentId;
        if (paymentMethod !== undefined) data.users[userIndex].paymentMethod = paymentMethod;
        if (message !== undefined) data.users[userIndex].message = message;
        if (highlight !== undefined) data.users[userIndex].highlight = highlight;
        if (msgColor !== undefined) data.users[userIndex].msgColor = msgColor;
        if (category !== undefined) data.users[userIndex].category = category;
        if (telegramChatId !== undefined) data.users[userIndex].telegramChatId = telegramChatId;
        if (whatsappNumber !== undefined) data.users[userIndex].whatsappNumber = whatsappNumber;
        if (subscriptionDays && subscriptionDays > 0) {
            data.users[userIndex].subscriptionExpiry = new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString();
        }
        
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
        const { usernames, message, msgColor, messageImage, sendTelegram, sendWhatsApp } = req.body;
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
                if (messageImage) u.messageImageUrl = messageImage;
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
                u.messageImageUrl = '';
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
                u.messageImageUrl = '';
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
// FOREX BROADCAST (separate from India market)
// ========================================

// Send forex broadcast to selected users
app.post('/api/admin/forex-broadcast', checkAdmin, async (req, res) => {
    try {
        const { usernames, message, msgColor, messageImage } = req.body;
        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return res.json({ success: false, message: 'Select at least one user' });
        }
        if (!message || message.trim() === '') {
            return res.json({ success: false, message: 'Message cannot be empty' });
        }
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (usernames.includes(u.username)) {
                u.forexMessage = message.trim();
                u.forexMsgColor = msgColor || '#ffb100';
                if (messageImage) u.forexMessageImageUrl = messageImage;
                count++;
            }
        });
        saveUsers(data);
        logActivity('forex_broadcast_sent', `Forex message sent to ${count} user(s)`);
        res.json({ success: true, message: `Forex message sent to ${count} user(s)` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Clear forex messages for multiple users
app.post('/api/admin/forex-clear-messages', checkAdmin, (req, res) => {
    try {
        const { usernames } = req.body;
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (usernames.includes(u.username)) {
                u.forexMessage = '';
                u.forexMsgColor = '#ffb100';
                u.forexMessageImageUrl = '';
                count++;
            }
        });
        saveUsers(data);
        res.json({ success: true, message: `Forex messages cleared for ${count} user(s)` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Clear ALL forex messages for ALL users
app.post('/api/admin/forex-clear-all-messages', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        let count = 0;
        data.users.forEach(u => {
            if (u.forexMessage && u.forexMessage.trim() !== '') {
                u.forexMessage = '';
                u.forexMsgColor = '#ffb100';
                u.forexMessageImageUrl = '';
                count++;
            }
        });
        saveUsers(data);
        res.json({ success: true, message: `All forex messages cleared for ${count} user(s)` });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// ========================================
// FOREX REAL DATA ENGINE (Yahoo Finance)
// Free real-time quotes - separate from India/Upstox data
// ========================================
const FOREX_YAHOO_SYMBOLS = {
    'EUR/USD':'EURUSD=X','GBP/USD':'GBPUSD=X','USD/JPY':'JPY=X','USD/CHF':'CHF=X','USD/INR':'INR=X','AUD/USD':'AUDUSD=X',
    'NZD/USD':'NZDUSD=X','USD/CAD':'CAD=X','EUR/GBP':'EURGBP=X','EUR/JPY':'EURJPY=X','GBP/JPY':'GBPJPY=X','AUD/JPY':'AUDJPY=X',
    'EUR/INR':'EURINR=X','GBP/INR':'GBPINR=X','USD/CNY':'CNY=X',
    'XAU/USD':'GC=F','XAG/USD':'SI=F','USOIL':'CL=F','BRENT':'BZ=F',
    'BTC/USD':'BTC-USD','ETH/USD':'ETH-USD','USDT':'USDT-USD','BNB/USD':'BNB-USD','SOL/USD':'SOL-USD','XRP/USD':'XRP-USD',
    'DOGE/USD':'DOGE-USD','ADA/USD':'ADA-USD','LTC/USD':'LTC-USD','DOT/USD':'DOT-USD','LINK/USD':'LINK-USD',
    'S&P 500':'^GSPC','NASDAQ':'^IXIC','DOW J':'^DJI','FTSE 100':'^FTSE','DAX 40':'^GDAXI','CAC 40':'^FCHI',
    'STOXX 50':'^STOXX50E','IBEX 35':'^IBEX','ASX 200':'^AXJO',
    'NIFTY 50':'^NSEI','SENSEX':'^BSESN','HANG SENG':'^HSI','SHANGHAI':'000001.SS','NIKKEI 225':'^N225',
    'KOSPI':'^KS11','TAIWAN SE':'^TWII'
};
let _fxLivePrices = {};
let _fxLiveStatus = { lastUpdate: 0, source: 'loading', ok: false };
function seedFxLivePrices() {
    const p = _fxLivePrices = {};
    Object.keys(FOREX_YAHOO_SYMBOLS).forEach(id => {
        p[id] = { base: 100, price: 100, chg: 0 };
    });
}
seedFxLivePrices();

async function fetchFxRealData() {
    try {
        const ids = Object.keys(FOREX_YAHOO_SYMBOLS);
        const chunkSize = 20;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunkIds = ids.slice(i, i + chunkSize);
            const symStr = chunkIds.map(id => FOREX_YAHOO_SYMBOLS[id]).join(',');
            const url = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + encodeURIComponent(symStr) + '&range=1d&interval=1m';
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
            if (!res.ok) continue;
            const j = await res.json();
            if (j && j.spark && j.spark.result) {
                j.spark.result.forEach(r => {
                    const id = chunkIds.find(x => FOREX_YAHOO_SYMBOLS[x] === r.symbol);
                    if (!id || !r.response || !r.response[0]) return;
                    const meta = r.response[0].meta;
                    const price = parseFloat(meta.regularMarketPrice);
                    const prev = parseFloat(meta.chartPreviousClose) || parseFloat(meta.previousClose) || price;
                    if (isFinite(price) && price > 0) {
                        const s = _fxLivePrices[id];
                        s.price = price;
                        s.base = prev;
                        s.chg = prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;
                    }
                });
            }
        }
        _fxLiveStatus = { lastUpdate: Date.now(), source: 'yahoo-real', ok: true };
    } catch (e) {
        _fxLiveStatus = { lastUpdate: Date.now(), source: 'last-known', ok: _fxLiveStatus.ok };
    }
}
fetchFxRealData();
setInterval(fetchFxRealData, 5000);

app.get('/api/forex/live', checkForexAccess, (req, res) => {
    const out = {};
    Object.keys(_fxLivePrices).forEach(id => {
        const s = _fxLivePrices[id];
        out[id] = { price: s.price, chg: s.chg };
    });
    // Backward-compatible: both top-level ids AND {data, status} so old cached clients work
    res.json(Object.assign({}, out, { data: out, status: _fxLiveStatus }));
});

// GIFT NIFTY scraper - price is server-rendered in giftnifty.com HTML
let _giftNifty = { price: null, chg: 0, base: 0 };
async function fetchGiftNifty() {
    try {
        const res = await fetch('https://giftnifty.com/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
        if (!res.ok) return;
        const html = await res.text();
        const pm = html.match(/id="heroPrice">\s*([\d,.]+)/);
        const cm = html.match(/id="changePill">\s*([-+]?[\d,.]+)\s*\(([-+]?[\d.]+)%\)/);
        if (pm) {
            const price = parseFloat(pm[1].replace(/,/g, ''));
            const chg = cm ? parseFloat(cm[1].replace(/,/g, '')) : 0;
            const pct = cm ? parseFloat(cm[2]) : 0;
            if (isFinite(price) && price > 0) {
                _giftNifty = { price, base: price - chg, chg: pct };
            }
        }
    } catch (e) {}
}
fetchGiftNifty();
setInterval(fetchGiftNifty, 10000);

// Admin Live Indices - Upstox India data + real forex/global symbols + GIFT NIFTY
const FOREX_LIVE_INDICES = ['S&P 500','NASDAQ','DOW J','HANG SENG','SHANGHAI','XAU/USD','USOIL','BTC/USD'];
app.get('/api/admin/indices', checkAdmin, async (req, res) => {
    const list = [];
    if (marketCache.indices.data && marketCache.indices.data.length > 0) {
        list.push(...marketCache.indices.data);
    }
    if (_giftNifty.price) {
        list.push({ name: 'GIFT NIFTY', ltp: +_giftNifty.price.toFixed(2), change: +((_giftNifty.price - _giftNifty.base).toFixed(2)), pct: _giftNifty.chg });
    }
    FOREX_LIVE_INDICES.forEach(name => {
        const s = _fxLivePrices[name];
        if (s) {
            list.push({ name, ltp: +s.price.toFixed(2), change: +((s.price - s.base).toFixed(2)), pct: s.chg });
        }
    });
    res.json(list);
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

        // Pending device approvals
        const pendingDevices = data.users.filter(u => u.pendingDevice).length;

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
                pendingDevices,
                categories,
                stockTips: { total: totalTips, active: activeTips }
            },
            recentActivity: log.activities.slice(0, 15)
        });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Get today's birthdays
app.get('/api/admin/birthdays', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const today = new Date();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();
        const birthdays = data.users.filter(u => {
            if (!u.dob) return false;
            const dob = new Date(u.dob);
            return dob.getMonth() === todayMonth && dob.getDate() === todayDate;
        }).map(u => ({
            username: u.username,
            fullName: u.fullName || u.username,
            age: today.getFullYear() - new Date(u.dob).getFullYear(),
            category: u.category || 'Silver'
        }));
        res.json({ success: true, birthdays });
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

// Admin: Get active/online users (users who logged in within last 15 minutes)
app.get('/api/admin/online-users', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const now = new Date();
        const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const onlineUsers = data.users.filter(u => {
            const lastSeen = u.lastActive || u.lastLogin;
            return lastSeen && new Date(lastSeen) > fifteenMinAgo;
        });
        const activeToday = data.users.filter(u => {
            const lastSeen = u.lastActive || u.lastLogin;
            return lastSeen && new Date(lastSeen) > oneDayAgo;
        });
        res.json({
            success: true,
            onlineCount: onlineUsers.length,
            activeTodayCount: activeToday.length,
            totalCount: data.users.length,
            onlineUsers: onlineUsers.map(u => ({ username: u.username, fullName: u.fullName || u.username, lastLogin: u.lastLogin }))
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
        tip.updatedAt = new Date().toISOString();
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
    if (db.isConnected()) {
        const cached = db.getCache('marketcache');
        if (cached) {
            cached.indices = cached.indices || { data: null, timestamp: 0 };
            cached.stocks = cached.stocks || { data: null, timestamp: 0, symbols: '' };
            cached.heatmap = cached.heatmap || { data: null, timestamp: 0 };
            cached.indices.timestamp = 0;
            cached.stocks.timestamp = 0;
            cached.heatmap.timestamp = 0;
            return cached;
        }
    }
    try {
        if (fs.existsSync(MARKET_CACHE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MARKET_CACHE_FILE, 'utf-8'));
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

function saveMarketCache(cacheData) {
    if (db.isConnected()) { db.debouncedSave('marketcache', cacheData); }
    try { fs.writeFileSync(MARKET_CACHE_FILE, JSON.stringify(cacheData)); } catch(e) {}
}

let marketCache = loadMarketCache();
const INDICES_CACHE_TTL = 3000;   // 3 seconds — background refresher keeps cache fresh
const STOCKS_CACHE_TTL = 30000;   // 30 seconds — background refresher keeps cache fresh

// ========================================
// REAL-TIME SIGNAL ENGINE
// Price history buffer for EMA/RSI calculations
// ========================================
const SIGNAL_HISTORY_FILE = path.join(__dirname, 'signalhistory.json');
const SIGNAL_HISTORY_MAX = 200;

let signalHistory = {};

function loadSignalHistory() {
    if (db.isConnected()) {
        const cached = db.getCache('signalhistory');
        if (cached && Object.keys(cached).length > 0) {
            signalHistory = cached;
            console.log('📁 Signal history loaded from MongoDB for', Object.keys(signalHistory).length, 'stocks');
            return;
        }
    }
    try {
        if (fs.existsSync(SIGNAL_HISTORY_FILE)) {
            signalHistory = JSON.parse(fs.readFileSync(SIGNAL_HISTORY_FILE, 'utf8'));
            console.log('📁 Signal history loaded from file for', Object.keys(signalHistory).length, 'stocks');
        }
    } catch (e) { signalHistory = {}; }
}

function saveSignalHistory() {
    if (db.isConnected()) { db.debouncedSave('signalhistory', signalHistory); }
    try { fs.writeFileSync(SIGNAL_HISTORY_FILE, JSON.stringify(signalHistory)); } catch (e) {}
}

function appendToHistory(symbol, ltp, volume) {
    if (!signalHistory[symbol]) signalHistory[symbol] = [];
    signalHistory[symbol].push({ ltp, volume: volume || 0, ts: Date.now() });
    if (signalHistory[symbol].length > SIGNAL_HISTORY_MAX) {
        signalHistory[symbol] = signalHistory[symbol].slice(-SIGNAL_HISTORY_MAX);
    }
}

loadSignalHistory();

function computeEMA(prices, period) {
    if (!prices || prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

function computeRSI(prices, period) {
    if (!prices || prices.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    if (losses === 0) return 100;
    return 100 - (100 / (1 + gains / losses));
}

function computeMomentum(prices, lookback) {
    if (!prices || prices.length < lookback + 1) return null;
    const past = prices[prices.length - 1 - lookback];
    return past ? ((prices[prices.length - 1] - past) / past) * 100 : null;
}

function computeVolumeTrend(volumes) {
    if (!volumes || volumes.length < 10) return 0;
    const recent = volumes.slice(-5);
    const older = volumes.slice(-10, -5);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    return avgOlder ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;
}

function generateSignal(symbol, stockData, history) {
    if (!stockData || stockData.ltp <= 0) return null;
    const ltp = stockData.ltp;
    const pct = stockData.pct || 0;

    if (!history || history.length < 5) {
        if (Math.abs(pct) < 0.3) return null;
        return {
            symbol, signal: pct > 0 ? 'BUY' : 'SELL', entry: ltp,
            target: pct > 0 ? parseFloat((ltp * 1.02).toFixed(2)) : parseFloat((ltp * 0.98).toFixed(2)),
            sl: pct > 0 ? parseFloat((ltp * 0.99).toFixed(2)) : parseFloat((ltp * 1.01).toFixed(2)),
            strategy: 'Momentum', confidence: Math.min(Math.abs(pct) * 20, 100).toFixed(0),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
            status: 'ACTIVE', rsi: null, ema9: null, ema21: null
        };
    }

    const prices = history.map(h => h.ltp);
    const volumes = history.map(h => h.volume);
    const ema9 = computeEMA(prices, Math.min(9, prices.length));
    const ema21 = computeEMA(prices, Math.min(21, prices.length));
    const rsi = computeRSI(prices, Math.min(14, prices.length - 1));
    const momentum = computeMomentum(prices, Math.min(10, prices.length - 1));
    const volTrend = computeVolumeTrend(volumes);

    let buyScore = 0, sellScore = 0, reasons = [];

    if (ema9 !== null && ema21 !== null) {
        if (ema9 > ema21) { buyScore += 30; reasons.push('EMA9>EMA21'); }
        else { sellScore += 30; reasons.push('EMA9<EMA21'); }
    }
    if (rsi !== null) {
        if (rsi < 30) { buyScore += 25; reasons.push('RSI Oversold(' + rsi.toFixed(0) + ')'); }
        else if (rsi > 70) { sellScore += 25; reasons.push('RSI Overbought(' + rsi.toFixed(0) + ')'); }
        else if (rsi < 45) { buyScore += 10; reasons.push('RSI Low(' + rsi.toFixed(0) + ')'); }
        else if (rsi > 55) { sellScore += 10; reasons.push('RSI High(' + rsi.toFixed(0) + ')'); }
    }
    if (momentum !== null) {
        if (momentum > 0.5) { buyScore += 20; reasons.push('Positive Momentum'); }
        else if (momentum < -0.5) { sellScore += 20; reasons.push('Negative Momentum'); }
    }
    if (ema9 !== null) {
        if (ltp > ema9) { buyScore += 15; reasons.push('Price>EMA9'); }
        else { sellScore += 15; reasons.push('Price<EMA9'); }
    }
    if (volTrend > 20) {
        if (buyScore > sellScore) buyScore += 10;
        else sellScore += 10;
        reasons.push('Volume Rising');
    }

    const totalScore = Math.max(buyScore, sellScore);
    if (totalScore < 35) return null;

    const isBuy = buyScore > sellScore;
    const recentPrices = prices.slice(-20);
    const volatility = Math.max(...recentPrices) - Math.min(...recentPrices);
    const targetDist = volatility * 0.5 || ltp * 0.02;
    const slDist = volatility * 0.3 || ltp * 0.01;

    return {
        symbol, signal: isBuy ? 'BUY' : 'SELL', entry: ltp,
        target: isBuy ? parseFloat((ltp + targetDist).toFixed(2)) : parseFloat((ltp - targetDist).toFixed(2)),
        sl: isBuy ? parseFloat((ltp - slDist).toFixed(2)) : parseFloat((ltp + slDist).toFixed(2)),
        strategy: ema9 !== null && ema21 !== null ? 'EMA Crossover' : 'Momentum',
        confidence: Math.min(totalScore, 95).toFixed(0),
        reasons: reasons.join(', '),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        status: 'ACTIVE',
        rsi: rsi ? rsi.toFixed(1) : null,
        ema9: ema9 ? parseFloat(ema9.toFixed(2)) : null,
        ema21: ema21 ? parseFloat(ema21.toFixed(2)) : null
    };
}

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
    // AUTO
    'TATAMOTORS': 'NSE_EQ|INE155A01022',
    'M&M': 'NSE_EQ|INE101A01026',
    'MARUTI': 'NSE_EQ|INE585B01010',
    'BAJAJ-AUTO': 'NSE_EQ|INE375F01016',
    'HEROMOTOCO': 'NSE_EQ|INE158A01026',
    'TVSMOTOR': 'NSE_EQ|INE494B01023',
    'EICHERMOT': 'NSE_EQ|INE233A01034',
    'TATAELXSI': 'NSE_EQ|INE670A01028',
    // BANK
    'HDFCBANK': 'NSE_EQ|INE040A01034',
    'ICICIBANK': 'NSE_EQ|INE090A01021',
    'KOTAKBANK': 'NSE_EQ|INE237A01036',
    'AXISBANK': 'NSE_EQ|INE238A01034',
    'SBIN': 'NSE_EQ|INE062A01020',
    'INDUSINDBK': 'NSE_EQ|INE090A01015',
    'BANDHANBNK': 'NSE_EQ|INE545U01014',
    'FEDERALBNK': 'NSE_EQ|INE450A01016',
    'PNB': 'NSE_EQ|INE160A01022',
    'IDFCFIRSTB': 'NSE_EQ|INE094T01019',
    // FINANCE
    'BAJFINANCE': 'NSE_EQ|INE296A01032',
    'BAJAJFINSV': 'NSE_EQ|INE061F01018',
    'HDFCLIFE': 'NSE_EQ|INE795G01014',
    'SBILIFE': 'NSE_EQ|INE123W01016',
    'ICICIPRULI': 'NSE_EQ|INE727G01019',
    'MANAPPURAM': 'NSE_EQ|INE529D01035',
    'MUTHOOTFIN': 'NSE_EQ|INE414G01027',
    'CHOLAFIN': 'NSE_EQ|INE121J01024',
    'CROMPTON': 'NSE_EQ|INE299U01018',
    // FMCG
    'ITC': 'NSE_EQ|INE154A01025',
    'HINDUNILVR': 'NSE_EQ|INE030A01027',
    'NESTLEIND': 'NSE_EQ|INE239A01024',
    'BRITANNIA': 'NSE_EQ|INE216A01035',
    'DABUR': 'NSE_EQ|INE016A01026',
    'MARICO': 'NSE_EQ|INE194A01024',
    'COLPAL': 'NSE_EQ|INE259A01022',
    'GODREJCP': 'NSE_EQ|INE524A01012',
    'EMAMILTD': 'NSE_EQ|INE878E01030',
    // IT
    'TCS': 'NSE_EQ|INE467B01029',
    'INFY': 'NSE_EQ|INE009A01021',
    'WIPRO': 'NSE_EQ|INE075A01022',
    'HCLTECH': 'NSE_EQ|INE860A01027',
    'TECHM': 'NSE_EQ|INE669C01036',
    'LTIM': 'NSE_EQ|INE214T01019',
    'MPHASIS': 'NSE_EQ|INE256B01013',
    'PERSISTENT': 'NSE_EQ|INE262B01018',
    'COFORGE': 'NSE_EQ|INE591G01017',
    'LTTS': 'NSE_EQ|INE010V01017',
    // MEDIA
    'RELIANCE': 'NSE_EQ|INE002A01018',
    'ZEE': 'NSE_EQ|INE256A01028',
    'SUNTV': 'NSE_EQ|INE800D01024',
    'PVRINOX': 'NSE_EQ|INE191H01014',
    'NAVINFLUOR': 'NSE_EQ|INE228B01018',
    // METAL
    'JSWSTEEL': 'NSE_EQ|INE019A01038',
    'TATASTEEL': 'NSE_EQ|INE081A01020',
    'HINDALCO': 'NSE_EQ|INE053A01015',
    'VEDL': 'NSE_EQ|INE205A01025',
    'NMDC': 'NSE_EQ|INE584B01024',
    'NATIONALUM': 'NSE_EQ|INE139A01034',
    'SAIL': 'NSE_EQ|INE113A01020',
    'JINDALSTEL': 'NSE_EQ|INE749A01033',
    // PHARMA
    'SUNPHARMA': 'NSE_EQ|INE044A01036',
    'DRREDDY': 'NSE_EQ|INE089A01031',
    'CIPLA': 'NSE_EQ|INE059A01037',
    'DIVISLAB': 'NSE_EQ|INE361B01038',
    'AUROPHARMA': 'NSE_EQ|INE406M01024',
    'TORNTPHARM': 'NSE_EQ|INE685A01028',
    'LUPIN': 'NSE_EQ|INE326A01037',
    'IPCALAB': 'NSE_EQ|INE576A01018',
    'ALKEM': 'NSE_EQ|INE540L01014',
    // PSU BANK
    'BANKBARODA': 'NSE_EQ|INE028A01039',
    'CANBK': 'NSE_EQ|INE476A01014',
    'INDIANB': 'NSE_EQ|INE562A01011',
    'UCOBANK': 'NSE_EQ|INE095A01015',
    'BANKINDIA': 'NSE_EQ|INE084A01019',
    // REALTY
    'DLF': 'NSE_EQ|INE271C01023',
    'GODREJPROP': 'NSE_EQ|INE610D01035',
    'OBEROIRLTY': 'NSE_EQ|INE093A01021',
    'PRESTIGE': 'NSE_EQ|INE818K01012',
    'BRIGADE': 'NSE_EQ|INE289A01031',
    'SOBHA': 'NSE_EQ|INE836K01020',
    'LODHA': 'NSE_EQ|INE677K01012',
    'PHOENIXLTD': 'NSE_EQ|INE211B01039',
    // OIL & GAS
    'ONGC': 'NSE_EQ|INE213A01029',
    'IOC': 'NSE_EQ|INE248A01010',
    'BPCL': 'NSE_EQ|INE029A01011',
    'HINDPETRO': 'NSE_EQ|INE034A01011',
    'GAIL': 'NSE_EQ|INE861T01014',
    'ADANIGREEN': 'NSE_EQ|INE410Y01023',
    // CONS DUR
    'TITAN': 'NSE_EQ|INE280A01028',
    'ASIANPAINT': 'NSE_EQ|INE021A01026',
    'VOLTAS': 'NSE_EQ|INE226A01024',
    'BLUESTARLT': 'NSE_EQ|INE045P01014',
    'SYMPHONY': 'NSE_EQ|INE225B01023',
    'RAJESHEXPO': 'NSE_EQ|INE200C01027',
    'KAJARIACER': 'NSE_EQ|INE217A01032'
};

// Reverse map: ISIN key → symbol (both pipe and colon formats)
const ISIN_TO_SYMBOL = {};
Object.entries(STOCK_ISIN_KEYS).forEach(([sym, isin]) => {
    ISIN_TO_SYMBOL[isin] = sym;
    ISIN_TO_SYMBOL[isin.replace('|', ':')] = sym;
});

// Fetch LTP from Upstox V3 API
let _upstox429Until = 0;
async function fetchUpstoxLTP(instrumentKeys) {
    if (Date.now() < _upstox429Until) return null;
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
            _upstox429Until = Date.now() + 10000;
            console.log('⚠️ Upstox rate limited — backing off 10s');
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

// Fetch index data — serve ONLY from cache (background refresher handles Upstox calls)
async function fetchIndicesData() {
    if (marketCache.indices.data && marketCache.indices.data.length > 0) {
        return marketCache.indices.data;
    }
    return null;
}

// Fetch stock data - try V2 first, fallback to V3 ISIN, with caching
// Background refresh — re-fetch and update cache without blocking the caller
let _bgFetchPending = false;
async function fetchStockQuoteBackground(symbols, symbolsKey) {
    if (_bgFetchPending) return;
    _bgFetchPending = true;
    try {
        const isinKeys = symbols.map(s => STOCK_ISIN_KEYS[s]).filter(k => k);
        if (isinKeys.length === 0) return;
        const data = await fetchUpstoxLTP(isinKeys);
        if (data && Object.keys(data).length > 0) {
            const result = {};
            Object.keys(data).forEach(key => {
                const symbol = ISIN_TO_SYMBOL[key] || key.split(/[:|]/).pop();
                if (STOCK_ISIN_KEYS[symbol]) {
                    const q = data[key];
                    const ltp = q.last_price || q.ltp || 0;
                    const cp = q.cp || q.close_price || ltp;
                    const change = ltp - cp;
                    const pct = cp > 0 ? (change / cp) * 100 : 0;
                    result[symbol] = { symbol, ltp, change, pct: parseFloat(pct.toFixed(2)), volume: q.volume || 0 };
                }
            });
            if (Object.keys(result).length > 0) {
                const merged = { ...(marketCache.stocks.data || {}), ...result };
                marketCache.stocks = { data: merged, timestamp: Date.now(), symbols: symbolsKey };
                saveMarketCache(marketCache);
            }
        }
    } catch (e) {
        console.log('⚠️ Background fetch error:', e.message);
    } finally {
        _bgFetchPending = false;
    }
}

async function fetchStockQuote(symbols) {
    const symbolsKey = symbols.sort().join(',');
    const now = Date.now();
    
    // Check if we have all these symbols individually cached (merged from previous fetches)
    if (marketCache.stocks && marketCache.stocks.data) {
        const allCached = symbols.every(s => marketCache.stocks.data[s]);
        if (allCached) {
            const filtered = {};
            symbols.forEach(s => { filtered[s] = marketCache.stocks.data[s]; });
            return filtered;
        }
        // Partial cache — return what we have, background refresher will fill the rest
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
    'AUTO': ['TATAMOTORS', 'M&M', 'MARUTI', 'BAJAJ-AUTO', 'HEROMOTOCO', 'TVSMOTOR', 'EICHERMOT', 'TATAELXSI', 'OBEROIRLTY'],
    'BANK': ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN', 'INDUSINDBK', 'BANDHANBNK', 'FEDERALBNK', 'PNB', 'IDFCFIRSTB'],
    'FINANCE': ['BAJFINANCE', 'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'ICICIPRULI', 'MANAPPURAM', 'MUTHOOTFIN', 'CHOLAFIN', 'CROMPTON'],
    'FMCG': ['ITC', 'HINDUNILVR', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'COLPAL', 'GODREJCP', 'EMAMILTD'],
    'IT': ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'MPHASIS', 'PERSISTENT', 'COFORGE', 'LTTS'],
    'MEDIA': ['RELIANCE', 'ZEE', 'SUNTV', 'PVRINOX', 'NAVINFLUOR'],
    'METAL': ['JSWSTEEL', 'TATASTEEL', 'HINDALCO', 'VEDL', 'NMDC', 'NATIONALUM', 'SAIL', 'JINDALSTEL'],
    'PHARMA': ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'AUROPHARMA', 'TORNTPHARM', 'LUPIN', 'IPCALAB', 'ALKEM'],
    'PSU BANK': ['SBIN', 'PNB', 'BANKBARODA', 'CANBK', 'INDIANB', 'UCO BANK', 'BANKINDIA'],
    'REALTY': ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'BRIGADE', 'SOBHA', 'LODHA', 'PHOENIXLTD'],
    'OIL & GAS': ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'HINDPETRO', 'GAIL', 'ADANIGREEN'],
    'CONS DUR': ['TITAN', 'ASIANPAINT', 'VOLTAS', 'BLUESTARLT', 'SYMPHONY', 'RAJESHEXPO', 'KAJARIACER']
};

// Heatmap with live data (updates every 30s)
function getActiveSectorStocks() {
    const settings = loadSettings();
    if (settings.sectorStocks && Object.keys(settings.sectorStocks).length > 0) return settings.sectorStocks;
    return SECTOR_STOCKS;
}

async function getHeatmapData() {
    const now = Date.now();
    if (marketCache.heatmap.data && (now - marketCache.heatmap.timestamp) < 30000) return marketCache.heatmap.data;

    const activeStocks = getActiveSectorStocks();
    const allSymbols = [...new Set(Object.values(activeStocks).flat())].filter(Boolean);
    if (allSymbols.length === 0) return SECTORS.map(s => ({ name: s, pct: 0 }));

    const stockData = await fetchStockQuote(allSymbols);
    if (!stockData) return SECTORS.map(s => ({ name: s, pct: 0 }));

    const data = SECTORS.map(sector => {
        const stocks = activeStocks[sector] || [];
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

app.get('/api/heatmap/sector-stocks', checkUserAuth, async (req, res) => {
    const sector = String(req.query.sector || '').trim().toUpperCase();
    const activeStocks = getActiveSectorStocks();
    const symbols = activeStocks[sector] || [];
    if (!symbols.length) return res.json([]);
    const data = await fetchStockQuote(symbols);
    if (!data) return res.json([]);
    res.json(symbols.filter(symbol => data[symbol]).map(symbol => data[symbol]));
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
    const allStocks = [...new Set([...TOP_GAINERS, ...TOP_LOSERS, ...FO_STOCKS])];
    const liveData = marketCache.stocks.data || {};

    allStocks.forEach(sym => {
        if (!liveData[sym] || liveData[sym].ltp <= 0) return;
        const history = signalHistory[sym] || [];
        const signal = generateSignal(sym, liveData[sym], history);
        if (signal) signals.push(signal);
    });

    signals.sort((a, b) => {
        if (a.signal === 'BUY' && b.signal !== 'BUY') return -1;
        if (a.signal !== 'BUY' && b.signal === 'BUY') return 1;
        return (b.confidence || 0) - (a.confidence || 0);
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
    const data = loadUsers();
    const today = new Date(); today.setHours(0,0,0,0);
    const userMap = {};
    log.logins.forEach(l => {
        if (!userMap[l.username]) userMap[l.username] = { username: l.username, todayCount: 0, lastLogin: null, lastSuccess: false, totalLogins: 0 };
        const entry = userMap[l.username];
        entry.totalLogins++;
        const ts = new Date(l.timestamp);
        if (ts >= today) entry.todayCount++;
        if (!entry.lastLogin || ts > new Date(entry.lastLogin)) {
            entry.lastLogin = l.timestamp;
            entry.lastSuccess = l.success;
        }
    });
    const result = Object.values(userMap).map(u => {
        const user = data.users.find(usr => usr.username === u.username);
        const online = user && user.lastActive && (Date.now() - new Date(user.lastActive).getTime() < 15 * 60 * 1000);
        return { ...u, fullName: user ? user.fullName : u.username, online: !!online };
    });
    result.sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''));
    res.json({ success: true, users: result.slice(0, 30) });
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
        const { usernames, message, msgColor, scheduledAt, sendTelegram, sendWhatsApp } = req.body;
        if (!message || !scheduledAt) return res.json({ success: false, message: 'Message and schedule time required' });
        const data = loadScheduledMsgs();
        const istDate = moment.tz(scheduledAt, 'Asia/Kolkata');
        const utcDate = istDate.clone().utc();
        const msg = {
            id: 'sched_' + Date.now(),
            usernames: usernames || [],
            message: message.trim(),
            msgColor: msgColor || '#ff6b35',
            scheduledAt: utcDate.toISOString(),
            scheduledAtIST: istDate.format('DD-MMM-YYYY hh:mm A'),
            sendTelegram: sendTelegram || false,
            sendWhatsApp: sendWhatsApp || false,
            sent: false,
            createdAt: new Date().toISOString()
        };
        data.messages.unshift(msg);
        saveScheduledMsgs(data);
        logActivity('message_scheduled', `Scheduled for ${istDate.format('DD-MMM-YYYY hh:mm A IST')}`);
        res.json({ success: true, message: 'Message scheduled!', schedule: msg });
    } catch (error) {
        console.error('Schedule error:', error);
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
        const { usernames, sendTelegram: doTG, sendWhatsApp: doWA, setDashMsg, customMsg } = req.body;
        const data = loadUsers();
        let sentCount = 0;
        let sentTelegram = 0;
        let sentWhatsApp = 0;

        for (const u of data.users) {
            if (!u.approved) continue;
            const days = getDaysUntilExpiry(u);
            if (usernames && usernames.length > 0) {
                if (!usernames.includes(u.username)) continue;
            } else {
                if (days < 0 || days > 30) continue;
            }
            const defaultMsg = `⚠️ Payment Reminder\n\nHi ${u.fullName || u.username},\n\nYour subscription expires in ${days} day(s).\nRenew now to continue getting stock tips.\n\nContact: Vaibhav\nBear Fighter Trading`;
            const reminderMsg = customMsg ? customMsg.replace(/\{name\}/g, u.fullName || u.username).replace(/\{days\}/g, days) : defaultMsg;

            if (doTG && u.telegramChatId) {
                await sendToTelegramChat(u.telegramChatId, reminderMsg);
                sentTelegram++;
            }
            if (doWA && u.whatsappNumber) {
                sentWhatsApp++;
            }
            if (setDashMsg) {
                u.message = customMsg ? customMsg.replace(/\{name\}/g, u.fullName || u.username).replace(/\{days\}/g, days) : `⚠️ Your subscription expires in ${days} day(s)! Renew now.`;
                u.msgColor = '#ff1744';
            }
            sentCount++;
        }

        saveUsers(data);
        logActivity('payment_reminders', `Sent to ${sentCount} users — Telegram: ${sentTelegram}, WhatsApp: ${sentWhatsApp}`);

        const waLinks = [];
        if (doWA) {
            for (const u of data.users) {
                if (!u.approved) continue;
                const days = getDaysUntilExpiry(u);
                if (u.whatsappNumber) {
                    if (usernames && usernames.length > 0) {
                        if (!usernames.includes(u.username)) continue;
                    } else {
                        if (days < 0 || days > 30) continue;
                    }
                    const reminderMsg = customMsg ? customMsg.replace(/\{name\}/g, u.fullName || u.username).replace(/\{days\}/g, days) : `⚠️ Hi ${u.fullName || u.username}, your subscription expires in ${days} day(s). Renew now! Contact: Vaibhav`;
                    const link = generateWhatsAppLink(u.whatsappNumber, reminderMsg);
                    if (link) waLinks.push({ username: u.username, daysLeft: days, link });
                }
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
        if (days >= 0) {
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
            const reminderMsg = `⚠️ Payment Reminder\n\nHi ${u.fullName || u.username},\nYour subscription expires in ${days} day(s). Renew now!\n\n— Vaibhav, Bear Fighter Trading`;
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
setInterval(async () => {
    const now = moment().tz('Asia/Kolkata');
    const data = loadScheduledMsgs();
    let changed = false;
    for (const msg of data.messages) {
        if (!msg.sent) {
            const schedUTC = new Date(msg.scheduledAt);
            if (schedUTC <= now.toDate()) {
                msg.sent = true;
                changed = true;
                console.log(`⏰ Sending scheduled msg: "${msg.message.substring(0,30)}..." to ${msg.usernames.length || 'ALL'} users`);
                const usersData = loadUsers();
                for (const u of usersData.users) {
                    if (msg.usernames.length === 0 || msg.usernames.includes(u.username)) {
                        u.message = msg.message;
                        u.msgColor = msg.msgColor || '#ff6b35';
                        if (msg.sendTelegram && u.telegramChatId) await sendBroadcastToUser(msg.message, u);
                        if (msg.sendWhatsApp && u.whatsappNumber) {
                            console.log(`💬 WhatsApp link for ${u.username}: ${u.whatsappNumber}`);
                        }
                    }
                }
                saveUsers(usersData);
                logActivity('scheduled_sent', `Scheduled message delivered: "${msg.message.substring(0,40)}..."`);
            }
        }
    }
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
    },
    bgColor: '#0a0a0a'
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
            sections: settings.dashboardSections || DEFAULT_DASHBOARD_SETTINGS.sections,
            bgColor: settings.dashBgColor || DEFAULT_DASHBOARD_SETTINGS.bgColor
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
        sections: settings.sections,
        bgColor: settings.bgColor
    });
});

// Admin: update dashboard settings
app.put('/api/admin/dashboard-settings', checkAdmin, (req, res) => {
    try {
        const { selectedIndices, sections, bgColor } = req.body;
        const settings = loadSettings();
        if (selectedIndices && Array.isArray(selectedIndices)) {
            settings.selectedIndices = selectedIndices.slice(0, 4);
        }
        if (sections && typeof sections === 'object') {
            settings.dashboardSections = { ...DEFAULT_DASHBOARD_SETTINGS.sections, ...sections };
        }
        if (bgColor) {
            settings.dashBgColor = bgColor;
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
        const isinKeys = allSymbols.map(s => STOCK_ISIN_KEYS[s]).filter(Boolean);
        if (isinKeys.length === 0) return;
        const data = await fetchUpstoxLTP(isinKeys);
        if (!data || Object.keys(data).length === 0) return;
        const result = {};
        Object.keys(data).forEach(key => {
            const symbol = ISIN_TO_SYMBOL[key] || key.split(/[:|]/).pop();
            if (STOCK_ISIN_KEYS[symbol]) {
                const q = data[key];
                const ltp = q.last_price || q.ltp || 0;
                const cp = q.cp || q.close_price || ltp;
                const change = ltp - cp;
                const pct = cp > 0 ? (change / cp) * 100 : 0;
                result[symbol] = { symbol, ltp, change, pct: parseFloat(pct.toFixed(2)), volume: q.volume || 0 };
            }
        });
        if (Object.keys(result).length > 0) {
            const merged = { ...(marketCache.stocks.data || {}), ...result };
            marketCache.stocks = { data: merged, timestamp: Date.now(), symbols: allSymbols.sort().join(',') };
            saveMarketCache(marketCache);
            Object.entries(result).forEach(([sym, d]) => {
                if (d.ltp > 0) appendToHistory(sym, d.ltp, d.volume || 0);
            });
        }
    } catch (e) {}
}

// ========================================
// OFFERS & PROMOTIONS
// ========================================
app.get('/api/offers', (req, res) => {
    try {
        const settings = loadSettings();
        const username = req.query.username || '';
        const offers = (settings.offers || []).filter(o => {
            if (!o.active) return false;
            if (o.expiry && new Date(o.expiry) < new Date()) return false;
            if (o.target === 'specific' && o.selectedUsers && o.selectedUsers.length) {
                if (!username || !o.selectedUsers.includes(username)) return false;
            }
            return true;
        });
        res.json({ success: true, offers });
    } catch (e) { res.json({ success: true, offers: [] }); }
});

app.get('/api/admin/offers', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        res.json({ success: true, offers: settings.offers || [] });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/offers', checkAdmin, (req, res) => {
    try {
        const { title, description, code, expiry, target, selectedUsers, theme, bgImage, bonusDays, maxUses } = req.body;
        if (!title) return res.json({ success: false, message: 'Title required' });
        const settings = loadSettings();
        if (!settings.offers) settings.offers = [];
        const offer = {
            id: 'offer_' + Date.now(),
            title: title.trim(),
            description: (description || '').trim(),
            code: (code || '').trim(),
            expiry: expiry || null,
            bonusDays: parseInt(bonusDays) || 7,
            maxUses: parseInt(maxUses) || 0,
            usedCount: 0,
            target: target || 'all',
            selectedUsers: (selectedUsers || []),
            theme: (theme || 'golden'),
            bgImage: (bgImage || ''),
            active: true,
            createdAt: new Date().toISOString()
        };
        settings.offers.push(offer);
        saveSettings(settings);
        const data = loadUsers();
        const targetUsers = data.users.filter(u => {
            if (target === 'all') return true;
            if (target === 'active') return isSubscriptionActive(u);
            if (target === 'expired') return !isSubscriptionActive(u);
            if (target === 'expiring') return isSubscriptionActive(u) && getDaysUntilExpiry(u) <= 7;
            if (target === 'specific') return (selectedUsers || []).includes(u.username);
            return (u.category || 'silver').toLowerCase() === target;
        });
        targetUsers.forEach(u => {
            if (!u.notifications) u.notifications = [];
            u.notifications.unshift({
                id: 'offer_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                type: 'offer', title: '🎁 ' + title,
                message: (description || '') + (code ? ' | Code: ' + code : ''),
                time: new Date().toISOString(), read: false
            });
            if (u.notifications.length > 50) u.notifications = u.notifications.slice(0, 50);
        });
        saveUsers(data);
        logActivity('offer_created', `Title: ${title}, Target: ${target}, Users notified: ${targetUsers.length}`);
        res.json({ success: true, message: `Offer sent to ${targetUsers.length} users!`, offer });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Device approval endpoints
app.get('/api/admin/pending-devices', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const pending = data.users.filter(u => u.pendingDevice).map(u => ({
            username: u.username, fullName: u.fullName || u.username,
            pendingDevice: u.pendingDevice
        }));
        res.json({ success: true, pending });
    } catch (e) { res.json({ success: false, pending: [] }); }
});

app.post('/api/admin/device/:username/approve', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const user = data.users.find(u => u.username === req.params.username);
        if (!user || !user.pendingDevice) return res.json({ success: false, message: 'No pending device' });
        user.approvedDevices = [user.pendingDevice.fingerprint];
        logActivity('device_approved', `Device approved for ${user.username}: ${user.pendingDevice.device}`);
        user.pendingDevice = null;
        saveUsers(data);
        res.json({ success: true, message: 'Device approved' });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/device/:username/reject', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const user = data.users.find(u => u.username === req.params.username);
        if (!user || !user.pendingDevice) return res.json({ success: false, message: 'No pending device' });
        logActivity('device_rejected', `Device rejected for ${user.username}: ${user.pendingDevice.device}`);
        user.pendingDevice = null;
        saveUsers(data);
        res.json({ success: true, message: 'Device rejected' });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/user/:username/class-access', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const user = data.users.find(u => u.username === req.params.username);
        if (!user) return res.json({ success: false, message: 'User not found' });
        user.classApproved = !user.classApproved;
        logActivity('class_access_toggled', `Class access ${user.classApproved ? 'granted' : 'revoked'} for ${user.username}`);
        saveUsers(data);
        res.json({ success: true, classApproved: user.classApproved, message: user.classApproved ? 'Class access granted' : 'Class access revoked' });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/user/:username/forex-access', checkAdmin, (req, res) => {
    try {
        const data = loadUsers();
        const user = data.users.find(u => u.username === req.params.username);
        if (!user) return res.json({ success: false, message: 'User not found' });
        user.forexAllowed = !user.forexAllowed;
        logActivity('forex_access_toggled', `Forex access ${user.forexAllowed ? 'granted' : 'revoked'} for ${user.username}`);
        saveUsers(data);
        res.json({ success: true, forexAllowed: user.forexAllowed, message: user.forexAllowed ? 'Forex access granted' : 'Forex access revoked' });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/offers/:id/toggle', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        const offer = (settings.offers || []).find(o => o.id === req.params.id);
        if (!offer) return res.json({ success: false });
        offer.active = !offer.active;
        saveSettings(settings);
        res.json({ success: true, active: offer.active });
    } catch (e) { res.json({ success: false }); }
});

app.put('/api/admin/offers/:id', checkAdmin, (req, res) => {
    try {
        const { title, description, code, expiry, target, selectedUsers, theme, bgImage, bonusDays, maxUses } = req.body;
        const settings = loadSettings();
        const offer = (settings.offers || []).find(o => o.id === req.params.id);
        if (!offer) return res.json({ success: false, message: 'Offer not found' });
        if (title !== undefined) offer.title = title.trim();
        if (description !== undefined) offer.description = description.trim();
        if (code !== undefined) offer.code = code.trim();
        if (expiry !== undefined) offer.expiry = expiry || null;
        if (bonusDays !== undefined) offer.bonusDays = parseInt(bonusDays) || 7;
        if (maxUses !== undefined) offer.maxUses = parseInt(maxUses) || 0;
        if (target !== undefined) offer.target = target;
        if (selectedUsers !== undefined) offer.selectedUsers = selectedUsers;
        if (theme !== undefined) offer.theme = theme;
        if (bgImage !== undefined) { if (bgImage) { offer.bgImage = bgImage; } else { delete offer.bgImage; } }
        offer.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true, message: 'Offer updated', offer });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

app.delete('/api/admin/offers/:id', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        settings.offers = (settings.offers || []).filter(o => o.id !== req.params.id);
        saveSettings(settings);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// ========================================
// PROMO CODE VALIDATION (User-side)
// ========================================
app.post('/api/validate-promo', (req, res) => {
    try {
        const userId = req.headers['user-id'];
        if (!userId) return res.status(401).json({ valid: false, message: 'Not logged in' });
        const { code } = req.body;
        if (!code || !code.trim()) return res.json({ valid: false, message: 'Enter a promo code' });
        const settings = loadSettings();
        const matched = (settings.offers || []).find(o =>
            o.active && o.code && o.code.toLowerCase() === code.trim().toLowerCase() &&
            (!o.expiry || new Date(o.expiry) >= new Date())
        );
        if (!matched) return res.json({ valid: false, message: 'Invalid or expired promo code' });
        const bonusDays = matched.bonusDays || 7;
        res.json({
            valid: true,
            offer: { id: matched.id, title: matched.title, description: matched.description, bonusDays, code: matched.code },
            message: matched.title + ' — +' + bonusDays + ' bonus days on renewal!'
        });
    } catch (e) { res.json({ valid: false, message: 'Server error' }); }
});

// ========================================
// RENEWAL REQUESTS (User submits, Admin approves)
// ========================================
app.post('/api/renewal-request', (req, res) => {
    try {
        const userId = req.headers['user-id'];
        if (!userId) return res.status(401).json({ success: false, message: 'Not logged in' });
        const data = loadUsers();
        const user = data.users.find(u => u.id === userId);
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });

        const { code, amount, category, planName, days, txnId } = req.body;
        let bonusDays = 0;
        let offerTitle = '';
        if (code) {
            const settings = loadSettings();
            const matched = (settings.offers || []).find(o =>
                o.active && o.code && o.code.toLowerCase() === code.trim().toLowerCase() &&
                (!o.expiry || new Date(o.expiry) >= new Date())
            );
            if (matched) {
                bonusDays = matched.bonusDays || 7;
                offerTitle = matched.title;
            }
        }

        const settings = loadSettings();
        if (!settings.renewalRequests) settings.renewalRequests = [];
        const request = {
            id: 'rr_' + Date.now(),
            userId: user.id,
            username: user.username,
            fullName: user.fullName || user.username,
            promoCode: code || null,
            offerTitle: offerTitle || null,
            bonusDays,
            amount: parseFloat(amount) || 0,
            category: category || user.category || 'Silver',
            planName: planName || null,
            planDays: parseInt(days) || 0,
            txnId: txnId || null,
            status: 'pending',
            requestedAt: new Date().toISOString()
        };
        settings.renewalRequests.push(request);
        saveSettings(settings);
        logActivity('renewal_request', `${user.username} requested renewal — Code: ${code || 'none'}, Bonus: ${bonusDays}d`);

        res.json({ success: true, message: 'Renewal request sent! Admin will process it shortly.', requestId: request.id });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Get all renewal requests
app.get('/api/admin/renewal-requests', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        const status = req.query.status || 'all';
        let requests = settings.renewalRequests || [];
        if (status !== 'all') requests = requests.filter(r => r.status === status);
        requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        res.json({ success: true, requests });
    } catch (e) { res.json({ success: false, requests: [] }); }
});

// Admin: Approve renewal request
app.post('/api/admin/renewal-requests/:id/approve', checkAdmin, (req, res) => {
    try {
        const { days } = req.body;
        const settings = loadSettings();
        const request = (settings.renewalRequests || []).find(r => r.id === req.params.id);
        if (!request) return res.json({ success: false, message: 'Request not found' });
        if (request.status !== 'pending') return res.json({ success: false, message: 'Already processed' });

        const extendDays = parseInt(days) || request.planDays || 30;
        const totalDays = extendDays + (request.bonusDays || 0);

        const data = loadUsers();
        const user = data.users.find(u => u.id === request.userId || u.username === request.username);
        if (!user) return res.json({ success: false, message: 'User not found' });

        const currentExpiry = new Date(user.subscriptionExpiry);
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        user.subscriptionExpiry = new Date(baseDate.getTime() + totalDays * 24 * 60 * 60 * 1000).toISOString();
        user.approved = true;
        if (request.amount) user.paymentAmount = (parseFloat(user.paymentAmount) || 0) + request.amount;
        user.lastRenewDate = new Date().toISOString();
        saveUsers(data);

        request.status = 'approved';
        request.approvedAt = new Date().toISOString();
        request.approvedDays = totalDays;
        saveSettings(settings);
        logActivity('renewal_approved', `${request.username} — ${extendDays}d + ${request.bonusDays || 0} bonus = ${totalDays}d`);

        res.json({ success: true, message: `${request.username} renewed for ${totalDays} days (${extendDays} + ${request.bonusDays || 0} bonus)` });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Reject renewal request
app.post('/api/admin/renewal-requests/:id/reject', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        const request = (settings.renewalRequests || []).find(r => r.id === req.params.id);
        if (!request) return res.json({ success: false, message: 'Request not found' });
        request.status = 'rejected';
        request.rejectedAt = new Date().toISOString();
        saveSettings(settings);
        logActivity('renewal_rejected', `${request.username} — Code: ${request.promoCode || 'none'}`);
        res.json({ success: true, message: 'Request rejected' });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Delete renewal request
app.delete('/api/admin/renewal-requests/:id', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        settings.renewalRequests = (settings.renewalRequests || []).filter(r => r.id !== req.params.id);
        saveSettings(settings);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// ========================================
// STUDENT TRADING CLASS (Admin CRUD + User access)
// ========================================

// Helper: check if user has class access
function hasClassAccess(user, classItem) {
    if (!classItem.access || classItem.access.type === 'all') return true;
    if (classItem.access.type === 'category') {
        const cats = Array.isArray(classItem.access.categories) ? classItem.access.categories : (classItem.access.categories || '').split(',').map(s => s.trim());
        return cats.includes((user.category || '').toLowerCase());
    }
    if (classItem.access.type === 'specific') {
        const users = Array.isArray(classItem.access.users) ? classItem.access.users : (classItem.access.users || '').split(',').map(s => s.trim());
        return users.includes(user.username);
    }
    return false;
}

// User: Get all classes they have access to
app.get('/api/classes', checkUserAuth, (req, res) => {
    try {
        const settings = loadSettings();
        const classes = (settings.classes || []).filter(c => c.active && hasClassAccess(req.user, c));
        res.json({ success: true, classes });
    } catch (e) { res.json({ success: false, classes: [] }); }
});

// User: Get single class by id
app.get('/api/classes/:id', checkUserAuth, (req, res) => {
    try {
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.id);
        if (!cls || !cls.active) return res.status(404).json({ success: false, message: 'Not found' });
        if (!hasClassAccess(req.user, cls)) return res.status(403).json({ success: false, message: 'Access denied' });
        res.json({ success: true, class: cls });
    } catch (e) { res.json({ success: false }); }
});

// Admin: Get all classes
app.get('/api/admin/classes', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        res.json({ success: true, classes: settings.classes || [] });
    } catch (e) { res.json({ success: false, classes: [] }); }
});

// Admin: Create class/module
app.post('/api/admin/classes', checkAdmin, (req, res) => {
    try {
        const { title, description, order, access, thumbnail } = req.body;
        if (!title) return res.json({ success: false, message: 'Title required' });
        const settings = loadSettings();
        if (!settings.classes) settings.classes = [];
        const cls = {
            id: 'class_' + Date.now(),
            title: title.trim(),
            description: (description || '').trim(),
            thumbnail: (thumbnail || '').trim(),
            order: parseInt(order) || settings.classes.length + 1,
            videos: [],
            access: access || { type: 'all', categories: [], users: [] },
            active: true,
            createdAt: new Date().toISOString()
        };
        settings.classes.push(cls);
        saveSettings(settings);
        logActivity('class_created', `Title: ${title}`);
        res.json({ success: true, message: 'Class created!', class: cls });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Update class
app.put('/api/admin/classes/:id', checkAdmin, (req, res) => {
    try {
        const { title, description, order, access, thumbnail, active } = req.body;
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.id);
        if (!cls) return res.json({ success: false, message: 'Not found' });
        if (title !== undefined) cls.title = title.trim();
        if (description !== undefined) cls.description = description.trim();
        if (thumbnail !== undefined) cls.thumbnail = thumbnail.trim();
        if (order !== undefined) cls.order = parseInt(order) || cls.order;
        if (access !== undefined) cls.access = access;
        if (active !== undefined) cls.active = active;
        cls.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true, message: 'Class updated', class: cls });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Delete class
app.delete('/api/admin/classes/:id', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        settings.classes = (settings.classes || []).filter(c => c.id !== req.params.id);
        saveSettings(settings);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// Admin: Add video to class
app.post('/api/admin/classes/:id/videos', checkAdmin, (req, res) => {
    try {
        const { title, youtubeUrl, url, duration } = req.body;
        const videoUrl = (url || youtubeUrl || '').trim();
        if (!title || !videoUrl) return res.json({ success: false, message: 'Title and URL required' });
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.id);
        if (!cls) return res.json({ success: false, message: 'Class not found' });
        if (!cls.videos) cls.videos = [];
        const video = {
            id: 'vid_' + Date.now(),
            title: title.trim(),
            url: videoUrl,
            youtubeUrl: videoUrl,
            duration: (duration || '').trim(),
            order: cls.videos.length + 1,
            createdAt: new Date().toISOString()
        };
        cls.videos.push(video);
        cls.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true, message: 'Video added!', video });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Remove video from class
app.delete('/api/admin/classes/:classId/videos/:videoId', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.classId);
        if (!cls) return res.json({ success: false, message: 'Class not found' });
        cls.videos = (cls.videos || []).filter(v => v.id !== req.params.videoId);
        cls.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// Admin: Update video (title/url/duration)
app.put('/api/admin/classes/:classId/videos/:videoId', checkAdmin, (req, res) => {
    try {
        const { title, url, duration } = req.body;
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.classId);
        if (!cls) return res.json({ success: false, message: 'Class not found' });
        const v = (cls.videos || []).find(x => x.id === req.params.videoId);
        if (!v) return res.json({ success: false, message: 'Video not found' });
        if (title !== undefined && title.trim()) { v.title = title.trim(); }
        if (url !== undefined && url.trim()) { v.url = url.trim(); v.youtubeUrl = url.trim(); }
        if (duration !== undefined) v.duration = duration.trim();
        cls.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true, message: 'Video updated', video: v });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Admin: Reorder videos in a class
app.post('/api/admin/classes/:classId/videos/reorder', checkAdmin, (req, res) => {
    try {
        const { orderedIds } = req.body;
        const settings = loadSettings();
        const cls = (settings.classes || []).find(c => c.id === req.params.classId);
        if (!cls) return res.json({ success: false, message: 'Class not found' });
        if (!Array.isArray(orderedIds) || !orderedIds.length) return res.json({ success: false, message: 'No order given' });
        const vids = cls.videos || [];
        orderedIds.forEach((id, idx) => {
            const v = vids.find(x => x.id === id);
            if (v) v.order = idx + 1;
        });
        cls.updatedAt = new Date().toISOString();
        saveSettings(settings);
        res.json({ success: true, message: 'Order updated' });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// ========================================
// HEATMAP STOCK SETTINGS (Admin)
// ========================================

app.get('/api/admin/sector-stocks', checkAdmin, (req, res) => {
    const settings = loadSettings();
    const sectorStocks = settings.sectorStocks || null;
    res.json({ success: true, sectorStocks, defaults: SECTOR_STOCKS });
});

app.post('/api/admin/sector-stocks', checkAdmin, (req, res) => {
    try {
        const { sector, stocks } = req.body;
        if (!sector || !Array.isArray(stocks)) return res.json({ success: false, message: 'Invalid data' });
        const settings = loadSettings();
        if (!settings.sectorStocks) settings.sectorStocks = JSON.parse(JSON.stringify(SECTOR_STOCKS));
        settings.sectorStocks[sector.toUpperCase()] = stocks.map(s => s.trim().toUpperCase()).filter(Boolean);
        saveSettings(settings);
        marketCache.heatmap = { data: null, timestamp: 0 };
        logActivity('Sector Stocks Updated', sector + ': ' + stocks.join(', '));
        res.json({ success: true, message: 'Sector stocks updated', stocks: settings.sectorStocks[sector.toUpperCase()] });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/api/admin/sector-stocks/reset', checkAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        settings.sectorStocks = null;
        saveSettings(settings);
        marketCache.heatmap = { data: null, timestamp: 0 };
        logActivity('Sector Stocks Reset', 'All sectors reset to defaults');
        res.json({ success: true, message: 'Reset to defaults' });
    } catch (e) { res.json({ success: false }); }
});

// ========================================
// HOLIDAY/FESTIVAL BANNERS
// ========================================
// HOLIDAY/FESTIVAL BANNERS
// ========================================

app.get('/api/banners', (req, res) => {
    try {
        const settings = loadSettings();
        const banners = settings.holidayBanners || [];
        const now = new Date().toISOString().split('T')[0];
        const deviceType = req.query.device || 'desktop';
        const active = banners.filter(b => {
            if (!b.active) return false;
            if (b.startDate && now < b.startDate) return false;
            if (b.endDate && now > b.endDate) return false;
            if (deviceType === 'desktop' && !b.showOnDesktop) return false;
            if (deviceType === 'mobile' && !b.showOnMobile) return false;
            return true;
        });
        const first = active[0];
        if (first && first.hasImage && db.isConnected()) {
            const imgPromise = db.getBannerImage(first.id);
            imgPromise.then(img => {
                if (img) first.imageUrl = img;
                else first.imageUrl = '';
                res.json({ success: true, banners: active });
            }).catch(() => res.json({ success: true, banners: active }));
        } else {
            res.json({ success: true, banners: active });
        }
    } catch (e) { res.json({ success: true, banners: [] }); }
});

app.get('/api/admin/banners', checkAdmin, async (req, res) => {
    try {
        const settings = loadSettings();
        const banners = settings.holidayBanners || [];
        if (db.isConnected()) {
            for (const b of banners) {
                if (b.hasImage) {
                    const img = await db.getBannerImage(b.id);
                    b.imageUrl = img || '';
                }
            }
        }
        res.json({ success: true, banners });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

app.get('/api/admin/banners/:id/image', checkAdmin, async (req, res) => {
    try {
        const img = await db.getBannerImage(req.params.id);
        if (img) res.json({ success: true, image: img });
        else res.json({ success: false });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/banners', checkAdmin, async (req, res) => {
    try {
        const { title, message, bgColor, textColor, imageUrl, startDate, endDate, showOnDesktop, showOnMobile, position, showTitle, titleColor, titleSize, bannerHeight, msgColor, msgSize, showMessage, emoji, isDefault } = req.body;
        if (!title || !startDate || !endDate) {
            return res.json({ success: false, message: 'Title, start date, and end date required' });
        }
        const settings = loadSettings();
        if (!settings.holidayBanners) settings.holidayBanners = [];
        const bannerId = 'banner_' + Date.now();
        const banner = {
            id: bannerId,
            title: title.trim(),
            message: (message || '').trim(),
            bgColor: bgColor || '#ff6b35',
            textColor: textColor || '#ffffff',
            imageUrl: '',
            hasImage: false,
            startDate, endDate,
            showOnDesktop: showOnDesktop !== false,
            showOnMobile: showOnMobile !== false,
            position: position || 'afterDisclaimer',
            active: true,
            isDefault: isDefault || false,
            showTitle: showTitle !== false,
            showMessage: showMessage !== false,
            emoji: emoji || '🎊',
            titleColor: titleColor || textColor || '#ffffff',
            titleSize: titleSize || 22,
            bannerHeight: bannerHeight || 120,
            msgColor: msgColor || textColor || '#ffffff',
            msgSize: msgSize || 13,
            createdAt: new Date().toISOString()
        };
        if (isDefault) {
            settings.holidayBanners.forEach(b => b.isDefault = false);
        }
        if (imageUrl && imageUrl.length > 100) {
            if (imageUrl.length > db.BANNER_IMAGE_MAX_BYTES * 1.37) {
                return res.json({ success: false, message: 'Image max 200KB!' });
            }
            banner.hasImage = true;
            banner.imageUrl = '';
            if (db.isConnected()) {
                await db.saveBannerImage(bannerId, imageUrl);
            } else {
                banner.imageUrl = imageUrl;
            }
        }
        settings.holidayBanners.push(banner);
        saveSettings(settings);
        res.json({ success: true, message: 'Banner created!', banner });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

app.put('/api/admin/banners/:id', checkAdmin, async (req, res) => {
    try {
        const settings = loadSettings();
        const banner = (settings.holidayBanners || []).find(b => b.id === req.params.id);
        if (!banner) return res.json({ success: false, message: 'Banner not found' });
        const { title, message, bgColor, textColor, imageUrl, startDate, endDate, showOnDesktop, showOnMobile, active, position, showTitle, titleColor, titleSize, bannerHeight, msgColor, msgSize, showMessage, emoji, isDefault } = req.body;
        if (title !== undefined) banner.title = title.trim();
        if (message !== undefined) banner.message = message.trim();
        if (bgColor !== undefined) banner.bgColor = bgColor;
        if (textColor !== undefined) banner.textColor = textColor;
        if (startDate !== undefined) banner.startDate = startDate;
        if (endDate !== undefined) banner.endDate = endDate;
        if (showOnDesktop !== undefined) banner.showOnDesktop = showOnDesktop;
        if (showOnMobile !== undefined) banner.showOnMobile = showOnMobile;
        if (active !== undefined) banner.active = active;
        if (position !== undefined) banner.position = position;
        if (showTitle !== undefined) banner.showTitle = showTitle;
        if (titleColor !== undefined) banner.titleColor = titleColor;
        if (titleSize !== undefined) banner.titleSize = titleSize;
        if (bannerHeight !== undefined) banner.bannerHeight = bannerHeight;
        if (msgColor !== undefined) banner.msgColor = msgColor;
        if (msgSize !== undefined) banner.msgSize = msgSize;
        if (showMessage !== undefined) banner.showMessage = showMessage;
        if (emoji !== undefined) banner.emoji = emoji;
        if (isDefault !== undefined) {
            banner.isDefault = isDefault;
            if (isDefault) settings.holidayBanners.forEach(b => { if (b.id !== banner.id) b.isDefault = false; });
        }
        if (imageUrl !== undefined) {
            if (imageUrl && imageUrl.length > 100) {
                if (imageUrl.length > db.BANNER_IMAGE_MAX_BYTES * 1.37) {
                    return res.json({ success: false, message: 'Image max 200KB!' });
                }
                banner.hasImage = true;
                banner.imageUrl = '';
                if (db.isConnected()) {
                    await db.saveBannerImage(banner.id, imageUrl);
                } else {
                    banner.imageUrl = imageUrl;
                }
            } else if (imageUrl === '' || imageUrl === null) {
                banner.hasImage = false;
                banner.imageUrl = '';
                if (db.isConnected()) await db.deleteBannerImage(banner.id);
            }
        }
        saveSettings(settings);
        res.json({ success: true, message: 'Banner updated!' });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

app.delete('/api/admin/banners/:id', checkAdmin, async (req, res) => {
    try {
        const settings = loadSettings();
        settings.holidayBanners = (settings.holidayBanners || []).filter(b => b.id !== req.params.id);
        saveSettings(settings);
        if (db.isConnected()) await db.deleteBannerImage(req.params.id);
        res.json({ success: true, message: 'Banner deleted' });
    } catch (e) { res.json({ success: false, message: 'Server error' }); }
});

// Start background refreshers
updateIndexKeys(); // Load selected indices from settings first
function startIndicesRefresher() {
    const delay = isMarketOpen() ? 2000 : 30000;
    setTimeout(async () => {
        await refreshIndicesBackground();
        startIndicesRefresher();
    }, delay);
}
startIndicesRefresher();
setInterval(refreshStocksBackground, 15000);
setInterval(saveSignalHistory, 60000);
// Initial refresh
setTimeout(refreshIndicesBackground, 2000);
setTimeout(refreshStocksBackground, 3000);

// ========================================
// SERVER START
// ========================================
async function startServer() {
    // Connect to MongoDB Atlas (falls back to JSON if unavailable)
    const mongoConnected = await db.connect();
    
    if (mongoConnected) {
        // Migrate JSON data → MongoDB if collections are empty
        await db.migrateFromJSON({
            users: USERS_FILE,
            settings: SETTINGS_FILE,
            stocktips: STOCKTIPS_FILE,
            activitylog: ACTIVITYLOG_FILE,
            loginhistory: LOGINHISTORY_FILE,
            registerrequests: REGISTERREQ_FILE,
            scheduledmsgs: SCHEDULED_MSGS_FILE,
            marketcache: MARKET_CACHE_FILE,
            signalhistory: SIGNAL_HISTORY_FILE
        });
        console.log('✅ MongoDB Atlas — all data synced');
    }

    // Ensure default admin exists
    const data = loadUsers();
    if (!data.users || data.users.length === 0) {
        console.log('📁 No users found — creating default admin...');
        saveUsers({ users: [createDefaultAdmin()] });
    }

    // Seed demo banner if no banners exist
    const settings = loadSettings();
    if (!settings.holidayBanners || settings.holidayBanners.length === 0) {
        settings.holidayBanners = [{
            id: 'banner_demo_1',
            title: 'Happy Diwali! 🪔',
            message: 'Bear Fighter Trading ki taraf se sabhi ko Diwali ki hardik shubhkamnaye!',
            bgColor: '#ff6b00',
            textColor: '#ffffff',
            imageUrl: 'https://images.pexels.com/photos/587741/pexels-photo-587741.jpeg?auto=compress&cs=tinysrgb&w=1200&h=300&dpr=1',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            showOnDesktop: true,
            showOnMobile: true,
            position: 'afterIndices',
            showTitle: true, titleColor: '#ffffff', titleSize: 22,
            bannerHeight: 120, msgColor: '#ffffff', msgSize: 13,
            showMessage: true, emoji: '🎊',
            active: true,
            createdAt: new Date().toISOString()
        }];
        saveSettings(settings);
        console.log('📁 Seeded demo banner');
    }

    // Load signal history
    loadSignalHistory();

    // Graceful shutdown — flush pending MongoDB writes
    const shutdown = async (sig) => {
        console.log(`\n🛑 ${sig} received — shutting down...`);
        await db.flushAll();
        await db.close();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    app.listen(PORT, () => {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🐻 BEAR FIGHTER TRADING - Login System`);
        console.log(`   By Vaibhav`);
        console.log(`🌐 Dashboard: http://localhost:${PORT}`);
        console.log(`🔐 Admin: use panel to login`);
        console.log(`💾 Database: ${mongoConnected ? 'MongoDB Atlas ✅' : 'JSON files (local)'}`);
        console.log(`📊 Background refresher: 2s indices (market hours) / 30s (closed), 15s stocks`);
        console.log(`${'='.repeat(50)}\n`);
    });
}

startServer();
