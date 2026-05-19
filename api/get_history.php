<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
require_once 'config.php';

// ?hours=24  (default 24, max 168 = 7 days)
// ?device_id=ESP32-001
// ?limit=200

$hours     = min((int)($_GET['hours']     ?? 24), 168);
$limit     = min((int)($_GET['limit']     ?? 200), 500);
$device_id = $_GET['device_id'] ?? 'ESP32-001';

$stmt = $conn->prepare(
    "SELECT
        water_level AS level,
        flow_rate   AS flow,
        temperature,
        recorded_at AS timestamp
     FROM sensor_data
     WHERE device_id   = ?
       AND recorded_at >= NOW() - INTERVAL ? HOUR
     ORDER BY recorded_at ASC
     LIMIT ?"
);
$stmt->bind_param("sii", $device_id, $hours, $limit);
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode([
    "status"    => "success",
    "device_id" => $device_id,
    "hours"     => $hours,
    "count"     => count($rows),
    "data"      => $rows
]);

$stmt->close();
$conn->close();
?>
