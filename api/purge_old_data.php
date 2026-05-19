<?php
/**
 * purge_old_data.php
 * Deletes sensor_data rows older than data_retention_days (from settings).
 * Can be called manually or via a cron job.
 *
 * Usage:
 *   Manual : http://localhost/smart-water-system/api/purge_old_data.php?api_key=SECRET123
 *   Cron   : 0 2 * * * php /path/to/api/purge_old_data.php --cron
 *
 * The cron flag skips the API key check (server-side only).
 */
header("Content-Type: application/json; charset=UTF-8");
require_once 'config.php';

$isCron = in_array('--cron', $argv ?? []);

if (!$isCron) {
    // Validate API key (same device key used by ESP32 insert)
    $api_key = $_GET['api_key'] ?? $_POST['api_key'] ?? '';
    $devStmt = $conn->prepare(
        "SELECT device_id FROM devices WHERE api_key = ? AND is_active = 1 LIMIT 1"
    );
    $devStmt->bind_param("s", $api_key);
    $devStmt->execute();
    if ($devStmt->get_result()->num_rows === 0) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Invalid API key"]);
        $devStmt->close();
        $conn->close();
        exit;
    }
    $devStmt->close();
}

// Fetch retention period from settings
$cfg  = $conn->query("SELECT data_retention_days FROM settings WHERE id=1 LIMIT 1")->fetch_assoc();
$days = (int)($cfg['data_retention_days'] ?? 90);

// Delete old sensor readings
$result = $conn->query(
    "DELETE FROM sensor_data WHERE recorded_at < NOW() - INTERVAL {$days} DAY"
);
$deletedSensor = $conn->affected_rows;

// Delete old resolved / acknowledged alert logs (keep unresolved indefinitely)
$result2 = $conn->query(
    "DELETE FROM alert_logs
     WHERE status IN ('Resolved','Acknowledged')
       AND alert_time < NOW() - INTERVAL {$days} DAY"
);
$deletedAlerts = $conn->affected_rows;

// Audit log for the purge
$conn->query(
    "INSERT INTO audit_log (action, table_name, new_value)
     VALUES ('DATA_PURGE', 'sensor_data,alert_logs',
             '{\"deleted_sensor\": $deletedSensor, \"deleted_alerts\": $deletedAlerts, \"retention_days\": $days}')"
);

echo json_encode([
    "status"          => "success",
    "retention_days"  => $days,
    "deleted_sensor"  => $deletedSensor,
    "deleted_alerts"  => $deletedAlerts,
    "message"         => "Purge complete. Removed $deletedSensor sensor records and $deletedAlerts old alert logs."
]);

$conn->close();
?>
