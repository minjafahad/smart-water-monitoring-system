-- ============================================================
--  Smart Water Services Monitoring System — Database Setup
--  Engine : MySQL / MariaDB
--  Database: smart_water_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_water_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_water_db;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    phone        VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role         ENUM('admin','technician','viewer') NOT NULL DEFAULT 'technician',
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    last_login   TIMESTAMP    NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
);

-- ------------------------------------------------------------
-- 2. SENSOR DATA  (from ESP32 via insert_data.php)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_data (
    id          INT       AUTO_INCREMENT PRIMARY KEY,
    device_id   VARCHAR(50) NOT NULL DEFAULT 'ESP32-001',
    water_level FLOAT     NOT NULL COMMENT 'Water level in %',
    flow_rate   FLOAT     NOT NULL COMMENT 'Flow rate in L/min',
    temperature FLOAT     NULL      COMMENT 'Optional temperature sensor in °C',
    voltage     FLOAT     NULL      COMMENT 'Optional battery voltage in V',
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sensor_device   (device_id),
    INDEX idx_sensor_time     (recorded_at),
    INDEX idx_sensor_level    (water_level),
    INDEX idx_sensor_flow     (flow_rate)
);

-- ------------------------------------------------------------
-- 3. ALERT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_logs (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    alert_type   ENUM('CRITICAL','WARNING','INFO','FLOW_HIGH','SENSOR_OFFLINE')
                              NOT NULL DEFAULT 'INFO',
    message      TEXT         NOT NULL,
    water_level  FLOAT        NULL COMMENT 'Level at time of alert',
    flow_rate    FLOAT        NULL COMMENT 'Flow rate at time of alert',
    recipients   TEXT         NULL COMMENT 'Comma-separated phone/emails notified',
    status       ENUM('Logged','Sent','Acknowledged','Resolved')
                              NOT NULL DEFAULT 'Logged',
    acknowledged_by INT       NULL,
    acknowledged_at TIMESTAMP NULL,
    alert_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alert_type   (alert_type),
    INDEX idx_alert_status (status),
    INDEX idx_alert_time   (alert_time)
);

-- ------------------------------------------------------------
-- 4. SYSTEM SETTINGS  (single-row config table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id                  INT          PRIMARY KEY,
    -- Threshold levels (%)
    critical_level      FLOAT        NOT NULL DEFAULT 15.0,
    warning_level       FLOAT        NOT NULL DEFAULT 25.0,
    -- Flow rate threshold (L/min)
    max_flow_rate       FLOAT        NOT NULL DEFAULT 30.0,
    -- Alert contacts
    primary_phone       VARCHAR(20)  DEFAULT '+255700000000',
    secondary_phone     VARCHAR(20)  DEFAULT '+255700000001',
    alert_email         VARCHAR(100) DEFAULT 'admin@smartwater.local',
    -- Data retention
    data_retention_days INT          NOT NULL DEFAULT 90,
    -- Polling interval for dashboard (seconds)
    poll_interval_sec   INT          NOT NULL DEFAULT 10,
    -- SMS / notification flag
    sms_enabled         TINYINT(1)   NOT NULL DEFAULT 1,
    email_enabled       TINYINT(1)   NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_critical CHECK (critical_level >= 0 AND critical_level <= 100),
    CONSTRAINT chk_warning  CHECK (warning_level  >= 0 AND warning_level  <= 100)
);

-- ------------------------------------------------------------
-- 5. DEVICES  (registered ESP32 nodes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    device_id    VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Matches sensor_data.device_id',
    device_name  VARCHAR(100) NOT NULL DEFAULT 'Water Sensor Node',
    location     VARCHAR(200) NULL,
    api_key      VARCHAR(64)  NOT NULL COMMENT 'Shared secret for insert_data.php',
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    last_seen    TIMESTAMP    NULL,
    firmware_ver VARCHAR(20)  DEFAULT '1.0.0',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_active (is_active)
);

-- ------------------------------------------------------------
-- 6. AUDIT LOG  (who changed settings / acknowledged alerts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NULL,
    action     VARCHAR(100) NOT NULL,
    table_name VARCHAR(50)  NULL,
    record_id  INT          NULL,
    old_value  TEXT         NULL,
    new_value  TEXT         NULL,
    ip_address VARCHAR(45)  NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user   (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_time   (created_at)
);

-- ============================================================
--  SEED DATA
-- ============================================================

-- Default system settings
INSERT INTO settings
    (id, critical_level, warning_level, max_flow_rate,
     primary_phone, secondary_phone, alert_email,
     data_retention_days, poll_interval_sec, sms_enabled, email_enabled)
VALUES
    (1, 15.0, 25.0, 30.0,
     '+255700000000', '+255700000001', 'admin@smartwater.local',
     90, 10, 1, 0)
ON DUPLICATE KEY UPDATE primary_phone = VALUES(primary_phone);

-- Default admin user
--   Password: Admin@1234  (bcrypt hash generated with PHP password_hash())
INSERT INTO users
    (full_name, username, email, phone, password_hash, role)
VALUES
    ('System Administrator', 'admin',
     'admin@smartwater.local', '+255700000000',
     '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'admin')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- Default device
INSERT INTO devices (device_id, device_name, location, api_key)
VALUES ('ESP32-001', 'Main Tank Sensor', 'Rooftop Tank — Building A', 'SECRET123')
ON DUPLICATE KEY UPDATE device_name = VALUES(device_name);

-- Sample sensor readings (last 24 h simulation)
INSERT INTO sensor_data (device_id, water_level, flow_rate, recorded_at) VALUES
('ESP32-001', 78.5, 12.3, NOW() - INTERVAL 23 HOUR),
('ESP32-001', 76.2, 11.8, NOW() - INTERVAL 22 HOUR),
('ESP32-001', 74.0, 13.1, NOW() - INTERVAL 21 HOUR),
('ESP32-001', 71.5, 12.9, NOW() - INTERVAL 20 HOUR),
('ESP32-001', 68.9, 14.2, NOW() - INTERVAL 19 HOUR),
('ESP32-001', 65.3, 13.7, NOW() - INTERVAL 18 HOUR),
('ESP32-001', 62.1, 11.5, NOW() - INTERVAL 17 HOUR),
('ESP32-001', 59.8, 10.9, NOW() - INTERVAL 16 HOUR),
('ESP32-001', 57.4, 12.1, NOW() - INTERVAL 15 HOUR),
('ESP32-001', 55.0, 13.4, NOW() - INTERVAL 14 HOUR),
('ESP32-001', 52.6, 14.8, NOW() - INTERVAL 13 HOUR),
('ESP32-001', 49.1, 15.2, NOW() - INTERVAL 12 HOUR),
('ESP32-001', 46.8, 14.9, NOW() - INTERVAL 11 HOUR),
('ESP32-001', 44.3, 13.5, NOW() - INTERVAL 10 HOUR),
('ESP32-001', 41.7, 12.0, NOW() - INTERVAL  9 HOUR),
('ESP32-001', 39.2, 11.3, NOW() - INTERVAL  8 HOUR),
('ESP32-001', 36.8, 10.7, NOW() - INTERVAL  7 HOUR),
('ESP32-001', 34.5, 12.5, NOW() - INTERVAL  6 HOUR),
('ESP32-001', 31.9, 13.2, NOW() - INTERVAL  5 HOUR),
('ESP32-001', 28.4, 14.1, NOW() - INTERVAL  4 HOUR),
('ESP32-001', 25.1, 13.8, NOW() - INTERVAL  3 HOUR),
('ESP32-001', 22.7, 12.6, NOW() - INTERVAL  2 HOUR),
('ESP32-001', 19.3, 11.4, NOW() - INTERVAL  1 HOUR),
('ESP32-001', 16.8, 10.2, NOW());

-- Sample alert log entries
INSERT INTO alert_logs (alert_type, message, water_level, flow_rate, status, alert_time) VALUES
('INFO',     'System initialised and monitoring started.',                80.0, 12.0, 'Acknowledged', NOW() - INTERVAL 23 HOUR),
('WARNING',  'Water level dropped below warning threshold (25%).',        24.8, 13.8, 'Resolved',     NOW() - INTERVAL  3 HOUR),
('CRITICAL', 'Water level is critically low! Immediate refill required.', 16.8, 10.2, 'Logged',       NOW() - INTERVAL  1 HOUR);

-- ============================================================
--  USEFUL VIEWS
-- ============================================================

-- Latest reading per device
CREATE OR REPLACE VIEW v_latest_readings AS
SELECT
    s.device_id,
    d.device_name,
    d.location,
    s.water_level,
    s.flow_rate,
    s.temperature,
    s.recorded_at,
    CASE
        WHEN s.water_level <= (SELECT critical_level FROM settings WHERE id=1) THEN 'CRITICAL'
        WHEN s.water_level <= (SELECT warning_level  FROM settings WHERE id=1) THEN 'WARNING'
        ELSE 'NORMAL'
    END AS level_status,
    CASE
        WHEN s.flow_rate   >= (SELECT max_flow_rate  FROM settings WHERE id=1) THEN 'HIGH'
        ELSE 'NORMAL'
    END AS flow_status
FROM sensor_data s
JOIN devices d ON d.device_id = s.device_id
WHERE s.recorded_at = (
    SELECT MAX(s2.recorded_at) FROM sensor_data s2 WHERE s2.device_id = s.device_id
);

-- 24-hour hourly averages
CREATE OR REPLACE VIEW v_hourly_averages AS
SELECT
    device_id,
    DATE_FORMAT(recorded_at, '%Y-%m-%d %H:00:00') AS hour_slot,
    ROUND(AVG(water_level), 2)                     AS avg_level,
    ROUND(AVG(flow_rate),   2)                     AS avg_flow,
    COUNT(*)                                       AS reading_count
FROM sensor_data
WHERE recorded_at >= NOW() - INTERVAL 24 HOUR
GROUP BY device_id, hour_slot
ORDER BY hour_slot;

-- Open alerts summary
CREATE OR REPLACE VIEW v_open_alerts AS
SELECT
    id, alert_type, message, water_level, flow_rate, status, alert_time
FROM alert_logs
WHERE status NOT IN ('Acknowledged', 'Resolved')
ORDER BY alert_time DESC;
