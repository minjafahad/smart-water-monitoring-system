<?php
/**
 * get_reports.php
 * Returns aggregated sensor data for the Reports page.
 *
 * Query params:
 *   ?period=daily|weekly|monthly  (default: daily)
 *   ?device_id=ESP32-001
 *   ?format=json|csv              (default: json)
 */
header("Access-Control-Allow-Origin: *");
require_once 'config.php';

$period    = $_GET['period']    ?? 'daily';
$device_id = $_GET['device_id'] ?? 'ESP32-001';
$format    = $_GET['format']    ?? 'json';

// Build the GROUP BY slot and date range based on period
switch ($period) {
    case 'weekly':
        $slotExpr  = "DATE_FORMAT(recorded_at, '%x-W%v')";    // ISO year-week
        $labelExpr = "DATE_FORMAT(recorded_at, '%x-W%v')";
        $interval  = "INTERVAL 7 DAY";
        break;
    case 'monthly':
        $slotExpr  = "DATE_FORMAT(recorded_at, '%Y-%m')";
        $labelExpr = "DATE_FORMAT(recorded_at, '%b %Y')";
        $interval  = "INTERVAL 30 DAY";
        break;
    default: // daily
        $slotExpr  = "DATE(recorded_at)";
        $labelExpr = "DATE_FORMAT(recorded_at, '%d %b')";
        $interval  = "INTERVAL 7 DAY";
}

$sql = "
    SELECT
        $slotExpr  AS period_key,
        $labelExpr AS label,
        ROUND(AVG(water_level), 2) AS avg_level,
        ROUND(MIN(water_level), 2) AS min_level,
        ROUND(MAX(water_level), 2) AS max_level,
        ROUND(AVG(flow_rate),   2) AS avg_flow,
        ROUND(MIN(flow_rate),   2) AS min_flow,
        ROUND(MAX(flow_rate),   2) AS max_flow,
        COUNT(*)                   AS readings
    FROM sensor_data
    WHERE device_id   = ?
      AND recorded_at >= NOW() - $interval
    GROUP BY period_key, label
    ORDER BY period_key ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $device_id);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();

// ---- Summary stats (all-time) ----
$summary = $conn->query(
    "SELECT
        COUNT(*)                       AS total_readings,
        ROUND(AVG(water_level), 2)     AS overall_avg_level,
        ROUND(MIN(water_level), 2)     AS overall_min_level,
        ROUND(MAX(water_level), 2)     AS overall_max_level,
        ROUND(AVG(flow_rate),   2)     AS overall_avg_flow,
        (SELECT COUNT(*) FROM alert_logs WHERE alert_type = 'CRITICAL') AS critical_alerts,
        (SELECT COUNT(*) FROM alert_logs WHERE alert_type = 'WARNING')  AS warning_alerts
     FROM sensor_data
     WHERE device_id = '$device_id'"
)->fetch_assoc();

// ---- CSV export ----
if ($format === 'csv') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="water_report_' . $period . '_' . date('Ymd') . '.csv"');
    $out = fopen('php://output', 'w');
    if (!empty($rows)) {
        fputcsv($out, array_keys($rows[0]));
        foreach ($rows as $r) {
            fputcsv($out, $r);
        }
    }
    fclose($out);
    $conn->close();
    exit;
}

// ---- JSON response ----
header("Content-Type: application/json; charset=UTF-8");
echo json_encode([
    "status"    => "success",
    "period"    => $period,
    "device_id" => $device_id,
    "summary"   => $summary,
    "data"      => $rows
]);

$conn->close();
?>
