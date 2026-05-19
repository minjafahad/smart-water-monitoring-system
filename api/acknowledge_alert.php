<?php
/**
 * acknowledge_alert.php
 * POST body: { "alert_id": 5, "action": "Acknowledged" | "Resolved" }
 * Requires an active session.
 */
session_start();
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Authentication required"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "POST method required"]);
    exit;
}

$data     = json_decode(file_get_contents('php://input'), true);
$alertId  = (int)($data['alert_id'] ?? 0);
$action   = $data['action'] ?? '';
$userId   = (int)$_SESSION['user_id'];

$validActions = ['Acknowledged', 'Resolved'];

if ($alertId <= 0) {
    echo json_encode(["status" => "error", "message" => "Invalid alert_id"]);
    exit;
}

if (!in_array($action, $validActions, true)) {
    echo json_encode(["status" => "error", "message" => "action must be Acknowledged or Resolved"]);
    exit;
}

$stmt = $conn->prepare(
    "UPDATE alert_logs
     SET status = ?, acknowledged_by = ?, acknowledged_at = NOW()
     WHERE id = ? AND status NOT IN ('Acknowledged','Resolved')"
);
$stmt->bind_param("sii", $action, $userId, $alertId);
$stmt->execute();

if ($stmt->affected_rows > 0) {
    $stmt->close();

    // Write audit entry
    $ip    = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $act   = strtoupper("ALERT_$action");
    $aStmt = $conn->prepare(
        "INSERT INTO audit_log (user_id, action, table_name, record_id, ip_address)
         VALUES (?,?,?,?,?)"
    );
    $tbl = 'alert_logs';
    $aStmt->bind_param("issis", $userId, $act, $tbl, $alertId, $ip);
    $aStmt->execute();
    $aStmt->close();

    echo json_encode(["status" => "success", "message" => "Alert marked as $action"]);
} else {
    $stmt->close();
    echo json_encode([
        "status"  => "error",
        "message" => "Alert not found or already $action"
    ]);
}

$conn->close();
?>
