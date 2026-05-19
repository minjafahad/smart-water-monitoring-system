<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
require_once 'config.php';

// Only logged-in admins may update settings
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

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Invalid JSON payload"]);
    exit;
}

// Allowed fields and their types
$allowed = [
    'critical_level'      => 'float',
    'warning_level'       => 'float',
    'max_flow_rate'       => 'float',
    'primary_phone'       => 'string',
    'secondary_phone'     => 'string',
    'alert_email'         => 'email',
    'data_retention_days' => 'int',
    'poll_interval_sec'   => 'int',
    'sms_enabled'         => 'bool',
    'email_enabled'       => 'bool',
];

$setClauses = [];
$bindValues = [];
$bindTypes  = '';

foreach ($allowed as $field => $type) {
    if (!array_key_exists($field, $data)) continue;

    $val = $data[$field];

    switch ($type) {
        case 'float':
            $val = (float)$val;
            if ($val < 0) {
                echo json_encode(["status" => "error", "message" => "$field cannot be negative"]);
                exit;
            }
            $bindTypes  .= 'd';
            break;
        case 'int':
            $val = (int)$val;
            $bindTypes  .= 'i';
            break;
        case 'bool':
            $val = $val ? 1 : 0;
            $bindTypes  .= 'i';
            break;
        case 'email':
            if (!filter_var($val, FILTER_VALIDATE_EMAIL)) {
                echo json_encode(["status" => "error", "message" => "Invalid email address"]);
                exit;
            }
            $bindTypes  .= 's';
            break;
        default:
            $val = substr(trim($val), 0, 100);
            $bindTypes  .= 's';
    }

    $setClauses[]  = "$field = ?";
    $bindValues[]  = $val;
}

if (empty($setClauses)) {
    echo json_encode(["status" => "error", "message" => "No valid fields provided"]);
    exit;
}

// Extra validation: critical_level must be < warning_level
$newCritical = $data['critical_level'] ?? null;
$newWarning  = $data['warning_level']  ?? null;

if ($newCritical !== null && $newWarning !== null) {
    if ((float)$newCritical >= (float)$newWarning) {
        echo json_encode(["status" => "error", "message" => "critical_level must be less than warning_level"]);
        exit;
    }
}

$sql  = "UPDATE settings SET " . implode(', ', $setClauses) . " WHERE id = 1";
$stmt = $conn->prepare($sql);
$stmt->bind_param($bindTypes, ...$bindValues);

if ($stmt->execute()) {
    // Audit log
    $userId = $_SESSION['user_id'];
    $ip     = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $newVal = json_encode($data);
    $aStmt  = $conn->prepare(
        "INSERT INTO audit_log (user_id, action, table_name, record_id, new_value, ip_address) VALUES (?,?,?,?,?,?)"
    );
    $action = 'UPDATE_SETTINGS';
    $table  = 'settings';
    $rid    = 1;
    $aStmt->bind_param("ississ", $userId, $action, $table, $rid, $newVal, $ip);
    $aStmt->execute();
    $aStmt->close();

    echo json_encode(["status" => "success", "message" => "Settings updated successfully"]);
} else {
    echo json_encode(["status" => "error", "message" => "Failed to update settings: " . $conn->error]);
}

$stmt->close();
$conn->close();
?>
