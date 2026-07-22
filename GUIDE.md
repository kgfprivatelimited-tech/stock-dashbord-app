# 🐻 BEARFIGHTER TRADING - Complete Guide
### By Vaibhav | Server: localhost:3000

---

## 📁 FILE LIST & WHAT EACH FILE DOES

| File | Kya karta hai |
|------|---------------|
| `index.js` | Main server - sab API routes, Telegram, WhatsApp, scheduler |
| `public/index.html` | Full frontend - Login, Dashboard, Admin Panel, CSS + JS sab isme |
| `public/manifest.json` | PWA config - phone pe install karne ke liye |
| `public/sw.js` | Service Worker - offline support + notifications |
| `.env` | Secret config - tokens, passwords, API keys |
| `users.json` | Saare registered users ka data |
| `settings.json` | Disclaimer text, maintenance mode, admin password |
| `stocktips.json` | Stock tips database (BUY/SELL tips) |
| `activitylog.json` | Activity log - kaun ne kya kiya |
| `loginhistory.json` | Login history - kaun kab login hua |
| `scheduledmsgs.json` | Scheduled messages - future mein bhejne wale messages |
| `package.json` | Dependencies list |
| `Start Server.bat` | Double-click to start server |
| `Stop Server.bat` | Double-click to stop server |
| `create-user.js` | Command line se user create karne ka tool |
| `GUIDE.md` | Yeh file - complete documentation |

---

## 🚀 SERVER START / STOP

### Method 1: Batch Files (Aasan)
- **Start:** `Start Server.bat` double-click karo
- **Stop:** `Stop Server.bat` double-click karo

### Method 2: Command Line
```bash
# Server start
cd "D:\big project - Copy\stock-dashbord-app"
node index.js

# Server stop (Windows)
# Task Manager mein jaake node.exe process karo
# Ya phir:
taskkill /F /IM node.exe
```

### Method 3: npm commands
```bash
npm start          # Start server
npm run dev        # Dev mode (auto-restart on changes)
```

---

## 🌐 ACCESS URLS

| URL | Kya dikhta hai |
|-----|---------------|
| `http://localhost:3000` | Main login page |
| `http://localhost:3000/admin` | Admin login |
| `http://192.168.1.4:3000` | Mobile access (same WiFi pe) |

---

## 🔐 LOGIN DETAILS

### Admin Login
- URL: `http://localhost:3000`
- Username: `admin`
- Password: `bearfighter@admin`
- Admin panel mein jaake password change kar sakte ho

### User Login
- Username/Password: Admin create karta hai
- Default category: Silver
- Subscription time limit hoti hai

---

## ⚙️ CONFIGURATION (.env file)

```
UPSTOX_API_KEY=...          # Upstox API key (stock data ke liye)
UPSTOX_ACCESS_TOKEN=...     # Upstox token (expire hota hai, update karna padega)
ADMIN_EMAIL=...             # Email config
ADMIN_EMAIL_PASSWORD=...    # Email password
ADMIN_PASSWORD=bearfighter@admin   # Default admin password
PORT=3000                   # Server port

# Telegram Bot
TELEGRAM_BOT_TOKEN=...      # Bot token from @BotFather
TELEGRAM_CHAT_ID=...        # Admin ka chat ID
```

### Upstox Token Kaise Update Kare:
1. https://api.upstox.com/v2/login ke through login karo
2. Naya access token milega
3. `.env` file mein `UPSTOX_ACCESS_TOKEN` update karo
4. Server restart karo

---

## 👥 USER MANAGEMENT (Admin Panel)

### User Create Karna
1. Admin Panel kholo
2. "Add New User" section mein details bharo:
   - Username, Email, Password, Full Name
   - Category: Silver / Gold / Diamond / Premium
   - Subscription Days: Kitne din valid rahega
   - Payment Amount, Payment ID, Payment Method
   - Telegram Chat ID (optional)
   - WhatsApp Number (optional, format: 91XXXXXXXXXX)
3. "Create User" button dabao

### User Edit Karna
1. Users list mein ✏️ (pencil) icon dabao
2. Details change karo
3. "Save Changes" dabao

### User Delete Karna
1. Users list mein 🗑️ (trash) icon dabao
2. Confirm karo

### User Block/Unblock
- Users list mein 🔴/🟢 button dabao

### Quick Renew (30 din)
- Users list mein 🔄 button dabao - turant 30 din badh jayega

### Bulk Category Change
1. Users table mein checkboxes select karo
2. "Change Category" dropdown se naya category choose karo
3. Apply button dabao

### Export Users
- "Export CSV" button se saare users ka Excel file download

---

## 📊 STOCK TIPS

### Tip Create Karna
1. Admin Panel > "📊 Stock Tips" section
2. Fields bharo:
   - Stock Symbol (e.g., RELIANCE)
   - Action: BUY ya SELL
   - Entry Price
   - Target Price
   - Stop Loss (SL)
   - Note (optional)
3. Checkboxes:
   - ✅ Send to Telegram (bot se users ko jaayega)
   - ✅ Send to WhatsApp (click-to-chat link milega)
4. "Add Tip" button dabao

### Tip Status
- **Active** - Abhi live hai
- **Target Done** ✅ - Target price hit ho gaya
- **SL Hit** ❌ - Stop loss hit ho gaya

### Tip Edit/Delete
- Tips list mein ✏️ aur 🗑️ buttons hai

---

## 📢 BROADCAST MESSAGE

### Message Bhejne Ka Tarika
1. Admin Panel > "📢 Broadcast Message"
2. Message type karo
3. Choose karo:
   - Color picker se message ka color
   - Template select karo (pre-made messages)
   - Ya apna likho
4. Users select karo:
   - Saare users
   - Ya specific category (Silver/Gold/Diamond/Premium)
   - Search karke specific user
5. Checkboxes:
   - ✅ Send to Telegram
   - ✅ Send to WhatsApp
6. "Send Broadcast" button dabao

### Message Clear Karna
- "Clear All Messages" - Sab users se message hata dega

---

## 💬 TELEGRAM INTEGRATION

### Setup
1. `@BotFather` pe `/newbot` karo
2. Bot token milega
3. `.env` mein `TELEGRAM_BOT_TOKEN` dalo
4. Apne bot ko `/start` karo
5. `@userinfobot` se apna Chat ID nikalo
6. `.env` mein `TELEGRAM_CHAT_ID` dalo

### User Ka Telegram Connect Karna
- Admin Panel mein user edit karo
- "Telegram Chat ID" mein uska chat ID dalo
- Ab stock tips aur broadcast uske Telegram pe jaayenge

### Kya Telegram pe jaata hai:
- Stock tips (BUY/SELL)
- Broadcast messages
- Payment reminders

---

## 📱 WHATSAPP INTEGRATION

### Setup
- Koi API nahi chahiye! Click-to-Chat link use hota hai

### User Ka WhatsApp Number
- Admin Panel mein user edit karo
- "WhatsApp Number" mein number dalo (format: 91XXXXXXXXXX)

### Kaise kaam karta hai:
- Jab stock tip ya broadcast bhejte ho
- WhatsApp button dikhta hai user ko
- Click karte hi WhatsApp khulta hai with pre-filled message
- User ko bas "Send" dabana hota hai

---

## 📅 SCHEDULED MESSAGES

### Message Schedule Karna
1. Admin Panel > "📅 Scheduled Messages"
2. Message likho
3. Date & Time choose karo
4. "Schedule" button dabao
5. Set time pe message automatically users ko jaayega

### Scheduled Messages Dekhna
- "Scheduled Messages" section mein sab dikh jaayega

### Cancel Karna
- ❌ button dabao

---

## 🔔 PUSH NOTIFICATIONS

### Enable Karna
- User login kare > 🔔 bell icon dabao
- Browser notification permission maangega
- Allow karo
- Ab naye messages pe notification aayega

---

## 💳 PAYMENT REMINDERS

### Auto Reminder System
- Server har 6 ghante mein check karta hai
- Jinke 1-3 din mein subscription expire ho raha hai
- Unhe automatic reminder jaata hai (Telegram + WhatsApp + Dashboard)

### Manual Reminder
- Admin Panel > "Send Reminders" button
- Abhi turant sab expiring users ko reminder bhejega

---

## 🔧 MAINTENANCE MODE

### Enable Karna
1. Admin Panel > "🔧 Maintenance Mode"
2. Toggle ON karo
3. Custom message likho (e.g., "Back in 30 mins")
4. Save karo

### Kya hota hai:
- Users ko maintenance page dikhta hai
- Sirf admin access kar sakta hai
- Admin panel ka access band nahi hota

### Disable Karna
- Toggle OFF karo

---

## 🎨 DISCLAIMER SETTINGS

### Change Karna
1. Admin Panel > "Disclaimer Settings"
2. Background color choose karo
3. Text color choose karo
4. Scroll speed adjust karo (1-50)
5. Disclaimer text edit karo
6. Preview dekho
7. Save karo

---

## 📱 PWA (Mobile Install)

### Phone Pe Install Karna
1. `http://192.168.1.4:3000` kholo (same WiFi pe)
2. Chrome mein "Add to Home Screen" pe click karo
3. App icon phone pe aa jaayega
4. Ab browser ki zaroorat nahi

### Offline Support
- Service Worker cache karta hai
- Internet nahi hai toh bhi basic content dikhega

---

## 🗂️ DATA FILES FORMAT

### users.json
```json
{
  "users": [
    {
      "id": "usr_123456",
      "username": "john",
      "email": "john@test.com",
      "password": "1234",
      "approved": true,
      "subscriptionExpiry": "2026-08-17T17:24:25.710Z",
      "fullName": "John Doe",
      "paymentAmount": 1000,
      "paymentId": "TXN123",
      "paymentMethod": "UPI",
      "telegramChatId": "",
      "whatsappNumber": "919876543210",
      "category": "Gold",
      "message": "Welcome!",
      "msgColor": "#ff6b35",
      "highlight": false
    }
  ]
}
```

### stocktips.json
```json
{
  "tips": [
    {
      "id": "tip_123456",
      "symbol": "RELIANCE",
      "action": "BUY",
      "entry": 2500,
      "target": 2600,
      "sl": 2450,
      "note": "Strong support",
      "status": "active",
      "createdAt": "2026-07-20T10:00:00Z"
    }
  ]
}
```

### settings.json
```json
{
  "disclaimerText": "We are not SEBI registered...",
  "disclaimerBgColor": "#f82912",
  "disclaimerTextColor": "#ffffff",
  "disclaimerSpeed": 20,
  "maintenanceMode": false,
  "maintenanceMessage": "Back in 30 mins!",
  "adminPassword": "bearfighter@admin"
}
```

---

## 🔑 API ENDPOINTS (Technical)

### User Routes
| Method | Endpoint | Kya karta hai |
|--------|----------|--------------|
| POST | `/api/login` | User login |
| POST | `/api/logout` | User logout |
| GET | `/api/me` | Current user info |
| GET | `/api/settings` | Site settings |
| GET | `/api/maintenance` | Maintenance check |

### Stock Data Routes (Login Required)
| Method | Endpoint | Kya karta hai |
|--------|----------|--------------|
| GET | `/api/indices` | Nifty, Sensex etc. |
| GET | `/api/gainers-losers` | Top gainers/losers |
| GET | `/api/heatmap` | Sector heatmap |
| GET | `/api/fo-stocks` | F&O stocks |
| GET | `/api/fno-all` | All F&O stocks |
| GET | `/api/signals` | Buy/Sell signals |
| GET | `/api/stocktips` | Active stock tips |

### Admin Routes (Admin Login Required)
| Method | Endpoint | Kya karta hai |
|--------|----------|--------------|
| GET | `/api/admin/users` | Saare users |
| POST | `/api/admin/approve` | User approve |
| POST | `/api/admin/block` | User block |
| POST | `/api/admin/renew` | Subscription renew |
| PUT | `/api/admin/user/:username` | User edit |
| DELETE | `/api/admin/user/:username` | User delete |
| POST | `/api/admin/broadcast` | Broadcast message |
| POST | `/api/admin/stocktips` | Stock tip add |
| PUT | `/api/admin/stocktips/:id` | Stock tip edit |
| DELETE | `/api/admin/stocktips/:id` | Stock tip delete |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/login-history` | Login history |
| GET | `/api/admin/tip-performance` | Tip stats |
| POST | `/api/admin/change-password` | Admin password change |
| POST | `/api/admin/bulk-category` | Bulk category change |
| POST | `/api/admin/schedule-message` | Schedule message |
| POST | `/api/admin/send-reminders` | Payment reminders |
| PUT | `/api/admin/settings` | Update settings |
| POST | `/api/admin/maintenance` | Toggle maintenance |

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Server start nahi ho raha
```bash
# Check karo port busy toh nahi
netstat -aon | findstr ":3000"

# Agar haan toh process kill karo
taskkill /PID <PID_NUMBER> /F

# Fir se start karo
node index.js
```

### Stock data nahi aa raha
- Upstox token expire ho sakta hai
- `.env` mein naya `UPSTOX_ACCESS_TOKEN` dalo
- Server restart karo

### Telegram messages nahi ja rahe
- Bot token check karo `.env` mein
- User ka Telegram Chat ID sahi hai ya nahi
- Bot ko `/start` kiya hai ya nahi

### Phone pe access nahi ho raha
- Phone aur computer same WiFi pe hona chahiye
- IP address: `192.168.1.4:3000`
- Firewall block kar raha ho sakta hai

### Page slow load ho rahi hai
- Gzip compression enabled hai (check `.env` ke baad)
- Browser cache clear karo
- Internet connection check karo

---

## 📞 CONTACT

**Developer:** Vaibhav
**Project:** BearFighter Trading Dashboard
**Version:** 1.0.0

---

*Last updated: July 2026*
