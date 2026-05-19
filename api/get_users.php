<?php
/**
 * get_users.php  — Admin only
 * GET  ?action=list
 * POST ?action=update  { id, full_name, email, phone, role, is_active }
 * POST ?action=delete  { id }
 */
session_start();
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");
require_once 'config.php';

// Must be logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Authentication required"]);
    exit;
}

// Check role = admin
$me = $conn->prepare("SELECT role FROM users WHERE id = ? LIMIT 1");
$me->bind_param("i", $_SESSION['user_id']);
$me->execute();
$meRow = $me->get_result()->fetch_assoc();
$me->close();

if (!$meRow || $meRow['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Admin access required"]);
    exit;
}

$action = $_GET['action'] ?? 'list';

// ---- LIST all users ----
if ($action === 'list') {
    $result = $conn->query(
        "SELECT id, full_name, username, email, phone, role, is_active, last_login, created_at
         FROM users ORDER BY created_at DESC"
    );
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    echo json_encode(["status" => "success", "count" => count($users), "users" => $users]);
    $conn->close();
    exit;
}

// ---- POST actions ----
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "POST required for this action"]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if ($action === 'create') {
    $full_name = substr(trim($data['full_name'] ?? ''), 0, 100);
    $username  = substr(trim($data['username'] ?? ''), 0, 50);
    $email     = $data['email'] ?? '';
    $phone     = substr(trim($data['phone'] ?? ''), 0, 20);
    $role      = in_array($data['role'] ?? '', ['admin','technician','viewer']) ? $data['role'] : 'viewer';
    $password  = $data['password'] ?? '';

    if (empty($full_name) || empty($username) || empty($email) || empty($password)) {
        echo json_encode(["status" => "error", "message" => "All fields except phone are required"]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "Invalid email format"]);
        exit;
    }

    if (strlen($password) < 8) {
        echo json_encode(["status" => "error", "message" => "Password must be at least 8 characters"]);
        exit;
    }

    $hashed_pw = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare(
        "INSERT INTO users (full_name, username, email, phone, role, password_hash, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, 1)"
    );
    $stmt->bind_param("ssssss", $full_name, $username, $email, $phone, $role, $hashed_pw);

    try {
        $stmt->execute();
        echo json_encode(["status" => "success", "message" => "User created successfully", "id" => $stmt->insert_id]);
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() === 1062) {
            echo json_encode(["status" => "error", "message" => "Username or email is already taken."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Creation failed: " . $e->getMessage()]);
        }
    }
    $stmt->close();
    $conn->close();
    exit;
}

// id-based actions: update, delete
$id = (int)($data['id'] ?? 0);
if ($id <= 0) {
    echo json_encode(["status" => "error", "message" => "Invalid user id"]);
    exit;
}

// Prevent deleting/deactivating yourself
if ($id === (int)$_SESSION['user_id'] && in_array($action, ['delete', 'update'])) {
    if ($action === 'delete' || (isset($data['is_active']) && !$data['is_active'])) {
        echo json_encode(["status" => "error", "message" => "You cannot modify your own account status"]);
        exit;
    }
}

if ($action === 'update') {
    $full_name = substr(trim($data['full_name'] ?? ''), 0, 100);
    $email     = $data['email'] ?? '';
    $phone     = substr(trim($data['phone'] ?? ''), 0, 20);
    $role      = in_array($data['role'] ?? '', ['admin','technician','viewer']) ? $data['role'] : 'technician';
    $is_active = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;

    $password = $data['password'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "Invalid email"]);
        exit;
    }

    if (!empty($password)) {
        if (strlen($password) < 8) {
            echo json_encode(["status" => "error", "message" => "Password must be at least 8 characters"]);
            exit;
        }
        $hashed_pw = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "UPDATE users SET full_name=?, email=?, phone=?, role=?, is_active=?, password_hash=? WHERE id=?"
        );
        $stmt->bind_param("ssssisi", $full_name, $email, $phone, $role, $is_active, $hashed_pw, $id);
    } else {
        $stmt = $conn->prepare(
            "UPDATE users SET full_name=?, email=?, phone=?, role=?, is_active=? WHERE id=?"
        );
        $stmt->bind_param("ssssii", $full_name, $email, $phone, $role, $is_active, $id);
    }

    try {
        $stmt->execute();
        echo json_encode(["status" => "success", "message" => "User updated successfully"]);
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() === 1062) {
            echo json_encode(["status" => "error", "message" => "Email is already used by another account."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Update failed: " . $e->getMessage()]);
        }
    }
    $stmt->close();

} elseif ($action === 'delete') {
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        echo json_encode(["status" => "success", "message" => "User deleted"]);
    } else {
        echo json_encode(["status" => "error", "message" => "User not found"]);
    }
    $stmt->close();

} else {
    echo json_encode(["status" => "error", "message" => "Unknown action"]);
}

$conn->close();
?>
