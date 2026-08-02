// ========================================
// MongoDB Atlas Database Layer
// In-memory cache + async MongoDB writes
// Same sync API so index.js needs zero changes
// ========================================

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'bearfighter';

let client = null;
let db = null;
let connected = false;

// Collections
const collections = {};
const BANNER_IMAGE_MAX_BYTES = 200 * 1024; // 200KB per banner image

// In-memory caches (loaded from MongoDB on startup)
const cache = {
    users: { users: [] },
    settings: null,
    stocktips: { tips: [] },
    activitylog: { activities: [] },
    loginhistory: { logins: [] },
    registerrequests: { requests: [] },
    scheduledmsgs: { messages: [] },
    marketcache: { indices: { data: null, timestamp: 0 }, stocks: { data: null, timestamp: 0, symbols: '' }, heatmap: { data: null, timestamp: 0 } },
    signalhistory: {}
};

// Banner images: { _id: bannerId, image: "base64..." }

// Debounce timers for batched writes
const writeTimers = {};
const WRITE_DEBOUNCE_MS = 2000; // 2 seconds

// ========================================
// CONNECT
// ========================================
async function connect() {
    if (!MONGODB_URI) {
        console.log('⚠️ MONGODB_URI not set — falling back to JSON files');
        return false;
    }
    try {
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 10000
        });
        await client.connect();
        db = client.db(DB_NAME);
        
        // Get collection references
        collections.users = db.collection('users');
        collections.settings = db.collection('settings');
        collections.stocktips = db.collection('stocktips');
        collections.activitylog = db.collection('activitylog');
        collections.loginhistory = db.collection('loginhistory');
        collections.registerrequests = db.collection('registerrequests');
        collections.scheduledmsgs = db.collection('scheduledmsgs');
        collections.marketcache = db.collection('marketcache');
        collections.signalhistory = db.collection('signalhistory');
        collections.bannerimages = db.collection('bannerimages');
        
        connected = true;
        console.log('✅ Connected to MongoDB Atlas');
        return true;
    } catch (e) {
        console.error('❌ MongoDB connection failed:', e.message);
        console.log('⚠️ Falling back to JSON files');
        return false;
    }
}

// ========================================
// LOAD — reads from memory cache
// Populated from MongoDB on startup
// ========================================
function isConnected() { return connected; }

function getCache(name) { return cache[name]; }

// ========================================
// SAVE — updates memory cache + async MongoDB write (debounced)
// ========================================
function debouncedSave(name, doc) {
    cache[name] = doc;
    if (!connected) return;
    
    if (writeTimers[name]) clearTimeout(writeTimers[name]);
    writeTimers[name] = setTimeout(async () => {
        try {
            await collections[name].updateOne(
                { _id: 'main' },
                { $set: { data: doc } },
                { upsert: true }
            );
        } catch (e) {
            console.error(`❌ MongoDB save ${name} failed:`, e.message);
        }
    }, WRITE_DEBOUNCE_MS);
}

// Immediate save (no debounce) — for critical writes
async function immediateSave(name, doc) {
    cache[name] = doc;
    if (!connected) return;
    try {
        await collections[name].updateOne(
            { _id: 'main' },
            { $set: { data: doc } },
            { upsert: true }
        );
    } catch (e) {
        console.error(`❌ MongoDB immediate save ${name} failed:`, e.message);
    }
}

// ========================================
// MIGRATE JSON → MongoDB
// If MongoDB collections are empty but JSON files exist, import them
// ========================================
async function migrateFromJSON(files) {
    if (!connected) return;
    
    for (const [name, filePath] of Object.entries(files)) {
        try {
            const count = await collections[name].countDocuments();
            if (count === 0 && fs.existsSync(filePath)) {
                const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                await collections[name].updateOne(
                    { _id: 'main' },
                    { $set: { data: rawData } },
                    { upsert: true }
                );
                cache[name] = rawData;
                console.log(`✅ Migrated ${name} from JSON to MongoDB`);
            } else if (count > 0) {
                // Load from MongoDB
                const doc = await collections[name].findOne({ _id: 'main' });
                if (doc && doc.data) {
                    cache[name] = doc.data;
                    console.log(`✅ Loaded ${name} from MongoDB`);
                }
            }
        } catch (e) {
            console.error(`⚠️ Migration ${name} failed:`, e.message);
        }
    }
}

// ========================================
// FLUSH — write all pending changes immediately (for shutdown)
// ========================================
async function flushAll() {
    if (!connected) return;
    const entries = Object.entries(cache);
    for (const [name, doc] of entries) {
        if (writeTimers[name]) {
            clearTimeout(writeTimers[name]);
            delete writeTimers[name];
        }
        try {
            await collections[name].updateOne(
                { _id: 'main' },
                { $set: { data: doc } },
                { upsert: true }
            );
        } catch (e) {
            console.error(`❌ Flush ${name} failed:`, e.message);
        }
    }
}

// ========================================
// CLOSE
// ========================================
async function close() {
    await flushAll();
    if (client) {
        await client.close();
        connected = false;
        console.log('🔌 MongoDB connection closed');
    }
}

module.exports = {
    connect,
    isConnected,
    getCache,
    debouncedSave,
    immediateSave,
    migrateFromJSON,
    flushAll,
    close,
    BANNER_IMAGE_MAX_BYTES,
    async getBannerImage(bannerId) {
        if (!connected) return null;
        try {
            const doc = await collections.bannerimages.findOne({ _id: bannerId });
            return doc ? doc.image : null;
        } catch (e) { return null; }
    },
    async saveBannerImage(bannerId, imageData) {
        if (!connected) return;
        try {
            await collections.bannerimages.updateOne(
                { _id: bannerId },
                { $set: { image: imageData, updatedAt: new Date() } },
                { upsert: true }
            );
        } catch (e) {
            console.error('❌ Save banner image failed:', e.message);
        }
    },
    async deleteBannerImage(bannerId) {
        if (!connected) return;
        try {
            await collections.bannerimages.deleteOne({ _id: bannerId });
        } catch (e) {
            console.error('❌ Delete banner image failed:', e.message);
        }
    }
};
