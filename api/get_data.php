<?php
/**
 * Enhanced get_data.php
 * Returns the latest sensor reading for one device plus
 * the current threshold settings so the frontend can
 * colour-code the gauges without a second request.
 */
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
require_once 'config.php';

$device_id = $_GET['device_id'] ?? 'ESP32-001';

// Latest sensor reading
$stmt = $conn->prepare(
    "SELECT
        water_level AS level,
        flow_rate   AS flow,
        temperature,
        device_id,
        recorded_at AS timestamp
     FROM sensor_data
     WHERE device_id = ?
     ORDER BY recorded_at DESC
     LIMIT 1"
);
$stmt->bind_param("s", $device_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $reading = $result->fetch_assoc();
} else {
    // Fallback if DB is empty — prevents UI from breaking
    $reading = [
        "level"       => 0,
        "flow"        => 0,
        "temperature" => null,
        "device_id"   => $device_id,
        "timestamp"   => date("Y-m-d H:i:s")
    ];
}
$stmt->close();

// Thresholds from settings
$cfg = $conn->query("SELECT critical_level, warning_level, max_flow_rate FROM settings WHERE id=1 LIMIT 1");
$thresholds = $cfg->fetch_assoc() ?? [
    "critical_level" => 15.0,
    "warning_level"  => 25.0,
    "max_flow_rate"  => 30.0
];

// Level status helper
$level     = (float)$reading['level'];
$flowRate  = (float)$reading['flow'];
$levelStatus = $level <= $thresholds['critical_level'] ? 'CRITICAL'
             : ($level <= $thresholds['warning_level'] ? 'WARNING' : 'NORMAL');
$flowStatus  = $flowRate >= $thresholds['max_flow_rate'] ? 'HIGH' : 'NORMAL';

// 24-hour stats
$stats = $conn->query(
    "SELECT
        ROUND(AVG(water_level),1) AS avg_level,
        ROUND(MIN(water_level),1) AS min_level,
        ROUND(MAX(water_level),1) AS max_level,
        ROUND(AVG(flow_rate),1)   AS avg_flow
     FROM sensor_data
     WHERE device_id = '$device_id'
       AND recorded_at >= NOW() - INTERVAL 24 HOUR"
)->fetch_assoc();

// Device connection status (consider offline if last_seen > 2 mins ago)
$devCheck = $conn->query("SELECT last_seen, (last_seen < NOW() - INTERVAL 2 MINUTE) OR last_seen IS NULL AS is_offline FROM devices WHERE device_id = '$device_id' LIMIT 1");
$devData  = $devCheck->fetch_assoc();
$isOffline = ($devData && $devData['is_offline']);
$deviceStatus = $isOffline ? 'OFFLINE' : 'ONLINE';
$lastSeen = $devData['last_seen'] ?? null;

// Auto-log SENSOR_OFFLINE alert if needed
if ($isOffline) {
    $dupAlert = $conn->query(
        "SELECT id FROM alert_logs 
         WHERE alert_type = 'SENSOR_OFFLINE' AND status NOT IN ('Resolved') LIMIT 1"
    );
    if ($dupAlert->num_rows === 0) {
        $offlineMsg = "SENSOR_OFFLINE: Connection to $device_id lost. Last seen at " . ($lastSeen ?: 'Never');
        $conn->query(
            "INSERT INTO alert_logs (alert_type, message, status) 
             VALUES ('SENSOR_OFFLINE', '$offlineMsg', 'Logged')"
        );
    }
}

echo json_encode([
    "status"        => "success",
    "reading"       => $reading,
    "level_status"  => $levelStatus,
    "flow_status"   => $flowStatus,
    "device_status" => $deviceStatus,
    "last_seen"     => $lastSeen,
    "thresholds"    => $thresholds,
    "stats_24h"     => $stats
]);

$conn->close();
?>
