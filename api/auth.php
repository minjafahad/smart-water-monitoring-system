<?php
session_start();
header('Content-Type: application/json');
require_once 'config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $full_name = $data['full_name'] ?? '';
    $username = $data['username'] ?? '';
    $email = $data['email'] ?? '';
    $phone = $data['phone'] ?? '';
    $password = $data['password'] ?? '';
    $role = 'viewer'; // Default role for new signups. Admins can upgrade them.

    if (empty($full_name) || empty($username) || empty($password) || empty($email) || empty($phone)) {
        echo json_encode(['status' => 'error', 'message' => 'All fields are required']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (full_name, username, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssss", $full_name, $username, $email, $phone, $hash, $role);

    try {
        $stmt->execute();
        $_SESSION['user_id']   = $stmt->insert_id;
        $_SESSION['username']  = $username;
        $_SESSION['full_name'] = $full_name;
        $_SESSION['role']      = $role;
        echo json_encode(['status' => 'success', 'message' => 'User registered successfully']);
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() === 1062) {
            echo json_encode(['status' => 'error', 'message' => 'Username or email is already taken. Please choose another.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Registration failed. Please try again.']);
        }
    }
    $stmt->close();

} elseif ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    $stmt = $conn->prepare(
        "SELECT id, username, full_name, role, password_hash FROM users
         WHERE username = ? AND is_active = 1 LIMIT 1"
    );
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        if (password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id']   = $user['id'];
            $_SESSION['username']  = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role']      = $user['role'];

            // Update last_login timestamp
            $conn->query("UPDATE users SET last_login = NOW() WHERE id = {$user['id']}");

            echo json_encode([
                'status'    => 'success',
                'message'   => 'Logged in successfully',
                'user'      => $user['full_name'] ?: $user['username'],
                'role'      => $user['role']
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Incorrect password']);
        }
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Username not found or account inactive']);
    }
    $stmt->close();

} elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'success', 'message' => 'Logged out successfully']);

} elseif ($action === 'check') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'status' => 'authenticated',
            'user'   => $_SESSION['full_name'] ?? $_SESSION['username'],
            'role'   => $_SESSION['role'] ?? 'technician'
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'unauthenticated', 'message' => 'Not logged in']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
}

$conn->close();
?>
