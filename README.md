# Smart Water Services Monitoring System
## Quick-Start Guide

---

### Prerequisites
| Requirement | Version |
|---|---|
| XAMPP / WAMP / Laragon | Apache 2.4+, PHP 8.0+, MySQL 8+ |
| Browser | Chrome / Firefox / Edge |
| ESP32 firmware | HTTP GET/POST to `insert_data.php` |

---

### 1 — Database Setup
```bash
# Open MySQL terminal or phpMyAdmin and run:
mysql -u root -p < api/setup.sql
```
This creates `smart_water_db` with all tables, sample data, views, and a default admin account.

**Default credentials:**
| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@1234` |

> ⚠️ Change the password after first login via the Settings → user profile.

---

### 2 — Web Server Setup
Place the entire project folder inside your web root:
```
C:/xampp/htdocs/smart-water-system/
```

Start Apache + MySQL in XAMPP Control Panel, then open:
```
http://localhost/smart-water-system/login.html
```

---

### 3 — Database Config
Edit `api/config.php` if needed:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          // your MySQL password
define('DB_NAME', 'smart_water_db');
```

---

### 4 — ESP32 Integration
The ESP32 pushes data to `insert_data.php` over HTTP:

**Example GET request (from ESP32 Arduino code):**
```
http://<server-ip>/smart-water-system/api/insert_data.php
  ?api_key=SECRET123
  &level=65.5
  &flow=12.4
  &temp=28.1
  &voltage=3.7
```

**Expected JSON response:**
```json
{ "status": "success", "device_id": "ESP32-001", "level": 65.5, "flow": 12.4, "alert": null }
```

If the tank level drops below a threshold, `"alert"` will be `"CRITICAL"` or `"WARNING"`.

---

### 5 — Data Retention (Cron)
Schedule the purge script to run nightly:
```bash
# Linux cron (run at 2:00 AM daily)
0 2 * * * php /var/www/html/smart-water-system/api/purge_old_data.php --cron

# Windows Task Scheduler: run
php C:\xampp\htdocs\smart-water-system\api\purge_old_data.php --cron
```

---

### API Endpoint Summary

| Endpoint | Method | Purpose |
|---|---|---|
| `api/auth.php?action=login` | POST | Login |
| `api/auth.php?action=logout` | GET | Logout |
| `api/auth.php?action=check` | GET | Session check |
| `api/auth.php?action=register` | POST | Register user |
| `api/get_data.php` | GET | Latest reading + thresholds |
| `api/get_history.php` | GET | Time-series history |
| `api/get_alerts.php` | GET | Alert log (filterable) |
| `api/acknowledge_alert.php` | POST | Ack / Resolve alert |
| `api/get_settings.php` | GET | System settings |
| `api/update_settings.php` | POST | Update settings (auth) |
| `api/get_reports.php` | GET | Aggregated + CSV export |
| `api/get_users.php` | GET/POST | User management (admin) |
| `api/insert_data.php` | GET/POST | ESP32 data ingestion |
| `api/purge_old_data.php` | GET | Data retention purge |

---

### Project File Structure
```
smart-water-system/
├── index.html          ← Dashboard overview
├── water-level.html    ← Tank level detail
├── flow.html           ← Flow rate analytics
├── alerts.html         ← Alert log + SMS preview
├── reports.html        ← Aggregated reports + CSV
├── settings.html       ← Threshold & notification config
├── login.html          ← Authentication
├── register.html       ← User registration
├── css/
│   └── style.css
├── js/
│   ├── main.js         ← Global auth + sidebar
│   ├── dashboard.js    ← index.html
│   ├── water-level.js  ← water-level.html
│   ├── flow.js         ← flow.html
│   ├── alerts.js       ← alerts.html
│   ├── settings.js     ← settings.html
│   └── reports.js      ← reports.html
└── api/
    ├── setup.sql
    ├── config.php
    ├── auth.php
    ├── get_data.php
    ├── get_history.php
    ├── get_alerts.php
    ├── acknowledge_alert.php
    ├── get_settings.php
    ├── update_settings.php
    ├── get_reports.php
    ├── get_users.php
    ├── insert_data.php
    └── purge_old_data.php
```
