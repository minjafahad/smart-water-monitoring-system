<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
require_once 'config.php';

// ?status=Logged|Sent|Acknowledged|Resolved|all  (default: all)
// ?type=CRITICAL|WARNING|INFO|all               (default: all)
// ?limit=50

$status = $_GET['status'] ?? 'all';
$type   = $_GET['type']   ?? 'all';
$limit  = min((int)($_GET['limit'] ?? 50), 200);

$where  = [];
$params = [];
$types  = '';

if ($status !== 'all') {
    $where[]  = "status = ?";
    $params[] = $status;
    $types   .= 's';
}
if ($type !== 'all') {
    $where[]  = "alert_type = ?";
    $params[] = $type;
    $types   .= 's';
}

$whereClause = count($where) ? 'WHERE ' . implode(' AND ', $where) : '';
$sql = "SELECT id, alert_type, message, water_level, flow_rate, status, alert_time
        FROM alert_logs
        $whereClause
        ORDER BY alert_time DESC
        LIMIT $limit";

$stmt = $conn->prepare($sql);
if ($types) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

// Count totals per type
$counts = $conn->query(
    "SELECT alert_type, COUNT(*) AS cnt FROM alert_logs GROUP BY alert_type"
);
$summary = [];
while ($c = $counts->fetch_assoc()) {
    $summary[$c['alert_type']] = (int)$c['cnt'];
}

echo json_encode([
    "status"  => "success",
    "count"   => count($rows),
    "summary" => $summary,
    "alerts"  => $rows
]);

$stmt->close();
$conn->close();
?>
