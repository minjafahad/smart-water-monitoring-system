<?php
/**
 * insert_data.php  (v2)
 * Receives sensor readings from the ESP32 and:
 *  1. Saves the reading to sensor_data
 *  2. Checks against thresholds and auto-logs alerts
 *  3. Updates the device last_seen timestamp
 *
 * Usage (GET or POST):
 *   api/insert_data.php?api_key=SECRET123&level=65.5&flow=12.4
 *   Also supports optional: &temp=28.1&voltage=3.7&device_id=ESP32-001
 */
header("Content-Type: application/json; charset=UTF-8");
require_once 'config.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'])) {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit;
}

// ---- Authenticate via API key ----
$api_key = $_REQUEST['api_key'] ?? '';

// Look up device by api_key
$devStmt = $conn->prepare(
    "SELECT device_id FROM devices WHERE api_key = ? AND is_active = 1 LIMIT 1"
);
$devStmt->bind_param("s", $api_key);
$devStmt->execute();
$devResult = $devStmt->get_result();

if ($devResult->num_rows === 0) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Invalid or inactive API key"]);
    $devStmt->close();
    $conn->close();
    exit;
}

$device   = $devResult->fetch_assoc();
$deviceId = $device['device_id'];
$devStmt->close();

// ---- Parse sensor values ----
$level   = isset($_REQUEST['level'])   ? round((float)$_REQUEST['level'],   2) : null;
$flow    = isset($_REQUEST['flow'])    ? round((float)$_REQUEST['flow'],    2) : null;
$temp    = isset($_REQUEST['temp'])    ? round((float)$_REQUEST['temp'],    2) : null;
$voltage = isset($_REQUEST['voltage']) ? round((float)$_REQUEST['voltage'], 2) : null;

if ($level === null || $flow === null) {
    echo json_encode(["status" => "error", "message" => "Parameters 'level' and 'flow' are required"]);
    $conn->close();
    exit;
}

// Sanity bounds
if ($level < 0 || $level > 100) {
    echo json_encode(["status" => "error", "message" => "level must be between 0 and 100"]);
    $conn->close();
    exit;
}
if ($flow < 0) {
    echo json_encode(["status" => "error", "message" => "flow cannot be negative"]);
    $conn->close();
    exit;
}

// ---- Insert sensor reading ----
$ins = $conn->prepare(
    "INSERT INTO sensor_data (device_id, water_level, flow_rate, temperature, voltage)
     VALUES (?, ?, ?, ?, ?)"
);
$ins->bind_param("sdddd", $deviceId, $level, $flow, $temp, $voltage);

if (!$ins->execute()) {
    echo json_encode(["status" => "error", "message" => "Failed to save reading: " . $conn->error]);
    $ins->close();
    $conn->close();
    exit;
}
$ins->close();

// ---- Update device last_seen ----
$conn->query("UPDATE devices SET last_seen = NOW() WHERE device_id = '$deviceId'");

// ---- Resolve any SENSOR_OFFLINE alerts ----
$conn->query(
    "UPDATE alert_logs SET status = 'Resolved' 
     WHERE alert_type = 'SENSOR_OFFLINE' AND status NOT IN ('Resolved')"
);

// ---- Threshold checking -> auto-alert ----
$cfg = $conn->query(
    "SELECT critical_level, warning_level, max_flow_rate FROM settings WHERE id=1 LIMIT 1"
)->fetch_assoc();

$alertType = null;
$alertMsg  = null;

if ($level <= $cfg['critical_level']) {
    // Only log a new CRITICAL if none already logged in last 30 min for this device
    $dup = $conn->query(
        "SELECT id FROM alert_logs
         WHERE alert_type='CRITICAL' AND status NOT IN ('Resolved')
           AND alert_time >= NOW() - INTERVAL 30 MINUTE
         LIMIT 1"
    );
    if ($dup->num_rows === 0) {
        $alertType = 'CRITICAL';
        $alertMsg  = "CRITICAL: Water level at {$level}% — below critical threshold ({$cfg['critical_level']}%). Immediate action required!";
    }
} elseif ($level <= $cfg['warning_level']) {
    $dup = $conn->query(
        "SELECT id FROM alert_logs
         WHERE alert_type='WARNING' AND status NOT IN ('Resolved')
           AND alert_time >= NOW() - INTERVAL 60 MINUTE
         LIMIT 1"
    );
    if ($dup->num_rows === 0) {
        $alertType = 'WARNING';
        $alertMsg  = "WARNING: Water level at {$level}% — approaching critical level ({$cfg['critical_level']}%).";
    }
}

if ($flow >= $cfg['max_flow_rate']) {
    $dup = $conn->query(
        "SELECT id FROM alert_logs
         WHERE alert_type='FLOW_HIGH' AND status NOT IN ('Resolved')
           AND alert_time >= NOW() - INTERVAL 30 MINUTE
         LIMIT 1"
    );
    if ($dup->num_rows === 0) {
        // Insert flow alert separately
        $fMsg  = "FLOW_HIGH: Flow rate at {$flow} L/min — exceeds max ({$cfg['max_flow_rate']} L/min). Possible leak!";
        $fStmt = $conn->prepare(
            "INSERT INTO alert_logs (alert_type, message, water_level, flow_rate, status)
             VALUES ('FLOW_HIGH', ?, ?, ?, 'Logged')"
        );
        $fStmt->bind_param("sdd", $fMsg, $level, $flow);
        $fStmt->execute();
        $fStmt->close();
    }
}

if ($alertType && $alertMsg) {
    $aStmt = $conn->prepare(
        "INSERT INTO alert_logs (alert_type, message, water_level, flow_rate, status)
         VALUES (?, ?, ?, ?, 'Logged')"
    );
    $aStmt->bind_param("ssdd", $alertType, $alertMsg, $level, $flow);
    $aStmt->execute();
    $aStmt->close();
}

echo json_encode([
    "status"    => "success",
    "message"   => "Data recorded",
    "device_id" => $deviceId,
    "level"     => $level,
    "flow"      => $flow,
    "alert"     => $alertType
]);

$conn->close();
?>
