# BearFighter Trading - Complete Changelog
# Project: stock-dashbord-app
# Developer: Vaibhav
# Created: 2026-07-21
# This file documents ALL changes for future reference if a new AI model takes over.

---

## PROJECT OVERVIEW
- Server: Node.js + Express (`index.js`, port 3000)
- Frontend: Single HTML file (`public/index.html`)
- Data files: `users.json`, `settings.json`, `stocktips.json`, `activitylog.json`, `loginhistory.json`, `scheduledmsgs.json`, `marketcache.json`
- API Keys stored in: `settings.json` (admin can change from panel) with `.env` as fallback
- Admin password: `bearfighter@admin` (changeable from admin panel)
- User auth: `user-id` header, Admin auth: `admin-key` header
- Upstox V3 API for live market data
- Telegram bot + WhatsApp click-to-chat integration
- PWA enabled (`manifest.json` + `sw.js`)

---

## STOCK ISIN MAPPING (CORRECT)
All 20 stocks with correct ISINs for Upstox API:
```
RELIANCE = NSE_EQ|INE002A01018
TCS = NSE_EQ|INE467B01029
HDFCBANK = NSE_EQ|INE040A01026
INFY = NSE_EQ|INE009A01021
ICICIBANK = NSE_EQ|INE090A01021
SBIN = NSE_EQ|INE062A01020
BHARTIARTL = NSE_EQ|INE398D01024
ADANIPORTS = NSE_EQ|INE742F01042
ASIANPAINT = NSE_EQ|INE009A01039
AXISBANK = NSE_EQ|INE238A01034
BAJFINANCE = NSE_EQ|INE296A01024
KOTAKBANK = NSE_EQ|INE128B01030
SUNPHARMA = NSE_EQ|INE044A01036
TITAN = NSE_EQ|INE280A01028
ULTRACEMCO = NSE_EQ|INE047H01020
WIPRO = NSE_EQ|INE075A01022
NESTLEIND = NSE_EQ|INE239A01024
JSWSTEEL = NSE_EQ|INE019A01038
HINDUNILVR = NSE_EQ|INE030A01027
ITC = NSE_EQ|INE154A01025
```
API keys use BOTH pipe (`NSE_EQ|...`) and colon (`NSE_EQ:...`) format.

---

## API KEYS CONFIGURATION
Server reads keys dynamically from `settings.json` (can be changed from admin panel):
- `upstoxApiKey` — Upstox API Key
- `upstoxAccessToken` — Upstox Access Token (expires ~Aug 2026)
- `telegramBotToken` — Telegram Bot Token
- `telegramChatId` — Telegram Chat ID
Fallback: `.env` file

Admin panel → API Keys section has show/hide toggle (eye button) for each key.

---

## COMPLETE CHANGELOG (chronological order)

### 1. BASIC DASHBOARD
- Single page app with login system
- Admin panel with left sidebar navigation
- User dashboard with indices, gainers/losers, heatmap, F&O, signals, stock tips
- PWA support (manifest.json + service worker)
- Dark theme throughout

### 2. STOCK DATA & MARKET
- Upstox V3 API: `https://api.upstox.com/v3/market-quote/ltp?instrument_key=...`
- Index keys: `NSE_INDEX|Nifty 50`, `NSE_INDEX|Nifty Bank`, `BSE_INDEX|SENSEX`, `NSE_INDEX|Nifty Fin Service`
- Server-side caching: indices 3s TTL, stocks 15s TTL
- Background refresher: indices every 2s, stocks every 10s
- `marketcache.json` file persists data across server restarts
- Browser cache disabled: `maxAge: '0'` on static middleware
- `fetchStockQuote()` merges data from multiple API calls into shared cache
- Heatmap: 12 sectors with representative stocks

### 3. USER MANAGEMENT
- Categories: Silver, Gold, Diamond, Premium (default Silver)
- Payment Method: `<select>` with UPI/Bank/Card/Cash options
- Case-insensitive payment method matching in edit
- Create User form with Cancel button (clears form + goes to All Users)
- Edit User form with Cancel button
- Delete User with confirm modal
- Block/Unblock user with subscription renewal
- Bulk category change

### 4. ALL USERS TABLE (8 columns)
- User (name + email + phone), Category, Status, Amount, Payment Method, Expires, Last Login, Actions
- Click on row → opens Edit User form
- Action buttons use `event.stopPropagation()` to prevent row click
- Search bar in All Users section (name, email, phone, amount)
- Top bar search → navigates to All Users and filters
- `min-width: 900px` for 8 columns
- `grid-template-columns: 1.8fr 0.8fr 0.7fr 0.6fr 0.6fr 0.7fr 1fr 0.8fr`

### 5. ADMIN PANEL SECTIONS
Left sidebar nav items:
- Dashboard (Overview), Create User, All Users
- Stock Tips, Broadcast
- Tip Performance, Recent Activity, Login History
- Disclaimer Settings, Dashboard Settings
- **Revenue section removed from nav**

### 6. BROADCAST SYSTEM
- Select users with checkboxes (All/None buttons)
- Quick templates (Buy/Sell/Target/Warning/Update)
- Banner color picker (4 colors: green, red, yellow, blue)
- Telegram/WhatsApp checkboxes for external send
- `sendTelegram`/`sendWhatsApp` boolean params sent to server
- Server respects these params for external sends
- Broadcast banner on user page with full text display
- `white-space: pre-wrap` + `word-break: break-word` for long messages
- `max-height: 140px` with scroll for very long messages

### 7. BROWSER NOTIFICATION + VIBRATION
- When broadcast banner appears:
  - `navigator.vibrate([200, 100, 200, 100, 300])` pattern
  - Browser Notification API (if permission granted)
  - Alert sound via Web Audio API (800Hz sine wave, 0.5s)
- Notification permission requested 3s after DOMContentLoaded
- Bell icon (🔔) in header to manually enable notifications

### 8. STOCK TIPS
- Auto-capitalize symbol: `text-transform: uppercase` + `oninput`
- Tip cards show: Action, Symbol, Entry, Target, SL, Note, "By Vaibhav"
- Status badges: TARGET DONE (green), SL HIT (red), TRENDING (orange)
- TRENDING badge: appears when broadcast message contains the tip's stock symbol
- `checkMessageUpdate()` re-renders tips when broadcast changes
- Server: `loadUsers()` bug fixed (was `data.users` → `loadUsers().users`)

### 9. STOCK TIPS TRENDING BADGE
- Logic: `broadcastMsg.includes(t.symbol.toUpperCase()) && status === 'active'`
- Orange gradient badge: `🔥 TRENDING` (top right, position absolute)
- Orange border glow: `border-color: #ff6b35; box-shadow: 0 0 12px rgba(255,107,53,0.3)`
- Re-renders when `checkMessageUpdate()` detects message change

### 10. DISCLAIMER SETTINGS
- Admin can customize: text, bg color, text color, speed, **font size** (8-28px)
- Color pickers show hex values
- Speed slider (5-60s)
- Font size slider (8-28px)
- Live preview section
- `disclaimerFontSize` stored in settings.json
- Server returns `disclaimerFontSize` in `/api/settings`
- User page ticker uses `fontSize` from settings
- Auto-refresh: every 15 seconds + localStorage cross-tab event
- Admin save triggers `localStorage.setItem('disclaimer_updated', Date.now())`
- User page listens: `window.addEventListener('storage', ...)`

### 11. DASHBOARD SETTINGS
- Section toggles (show/hide sections on user dashboard)
- Index selection (which indices to show)
- Saves to `settings.json`
- Auto-refresh every 30 seconds

### 12. DASHBOARD OVERVIEW (Admin)
- Stats cards: Revenue, Total Users, Active, Expired, Expiring Soon
- **Live Indices card** with NIFTY 50, BANK NIFTY, SENSEX
- Fixed JS type bug: `d.ltp` and `d.change` are strings from server, use `parseFloat()` before `.toLocaleString()` and `.toFixed()`
- Revenue Chart, Tip Performance, Recent Activity, Login History
- `/api/admin/indices` endpoint (admin auth, returns cached data)

### 13. API KEYS MANAGEMENT
- Admin panel → API Keys section (below Change Password)
- 4 fields: Upstox Key, Upstox Token, Telegram Token, Telegram Chat ID
- Each field has 👁️ show/hide toggle button
- All fields default to `type="password"` (hidden)
- Save button updates `settings.json`
- `toggleKeyVisibility(inputId, btn)` function toggles type + icon
- Server reads keys dynamically from `loadSettings()` (not const variables)
- `.env` as fallback when settings.json values are empty

### 14. SIDEBAR BRANDING
- Logo: 🐻 BearFighter
- "By Vaibhav" text (9px, #f59e0b, letter-spacing 1.5px, font-weight 600)
- Live clock (IST, hh:mm:ss, updates every second)
- Market status: 🟢 Market Open / 🔴 Market Closed
- Market hours check: 9:15 AM - 3:30 PM IST, weekends + holidays

### 15. CUSTOM MODAL SYSTEM
- `customAlert(msg, icon)` — OK button only
- `customConfirm(msg, icon, dangerText)` — OK + Cancel buttons
- Dark themed overlay with blur
- Animations: fade in + slide in
- All native `confirm()` and `alert()` replaced (29 instances)
- CSS injected via `createModalStyles()`

### 16. MAINTENANCE MODE
- Toggle switch (div-based, uses `classList.toggle('active')`)
- When ON: non-admin users see maintenance message
- Server returns 503 for `checkUserAuth` when maintenance active
- Custom maintenance message saved in settings.json

### 17. TELEGRAM INTEGRATION
- `sendToTelegram(message)` — reads bot token from settings dynamically
- `sendToTelegramChat(chatId, message)` — per-user chat
- `sendStockTipToTelegram(tip)` — formatted stock tip message
- `sendTipStatusToTelegram(tip, status)` — target done / SL hit notification
- All use HTML parse_mode
- Previously used `const TELEGRAM_BOT_TOKEN` (broken on change) → now reads from settings

### 18. DATA PERSISTENCE
- `marketcache.json` — indices + stocks + heatmap data (survives restarts)
- `saveMarketCache()` called on every successful API fetch
- `loadMarketCache()` called at server startup
- Timestamps set to 0 on load to force refresh, but data available immediately

### 19. MOBILE RESPONSIVE
- `@media (max-width: 768px)` rules
- Banner: smaller padding/font, `max-height: 120px`
- Table: overflow-x scroll for wide tables
- Stock tip form: single column
- Broadcast user list: smaller height
- Signal table: `min-width: 340px`

---

## KNOWN CONSTANTS
- Computer IP: `192.168.1.4:3000`
- User prefers Hindi communication
- Dark theme UI throughout

## KEY FILE LOCATIONS
- `index.js:1044` — DEFAULT_SETTINGS with API keys
- `index.js:1252` — `fetchStockQuote()` with merge cache
- `index.js:1193` — `fetchIndicesData()` with file persistence
- `index.js:245` — `sendToTelegram()` reads settings dynamically
- `public/index.html:4415` — `loadDashboardStockTips()` with trending badge
- `public/index.html:4908` — `checkMessageUpdate()` triggers tip re-render
- `public/index.html:3127` — `loadDashboardIndices()` with parseFloat fix
- `public/index.html:4575` — `updateAdminSidebarClock()` with market status

---

## FILE: CHANGELOG.md
Last updated: 2026-07-21
