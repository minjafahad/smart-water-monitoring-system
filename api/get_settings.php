<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
require_once 'config.php';

$result = $conn->query("SELECT * FROM settings WHERE id = 1 LIMIT 1");

if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo json_encode(["status" => "success", "settings" => $row]);
} else {
    echo json_encode(["status" => "error", "message" => "Settings not found"]);
}

$conn->close();
?>
