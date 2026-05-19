<?php
$hash = password_hash('Admin@1234', PASSWORD_BCRYPT);
$conn = new mysqli('localhost', 'root', '', 'smart_water_db');
if ($conn->connect_error) { die('Connection failed: ' . $conn->connect_error); }
$stmt = $conn->prepare('UPDATE users SET password_hash=?, role=? WHERE username=?');
$role = 'admin'; $user = 'admin';
$stmt->bind_param('sss', $hash, $role, $user);
$stmt->execute();
echo 'Updated ' . $stmt->affected_rows . ' row(s).' . PHP_EOL;
echo 'New hash: ' . $hash . PHP_EOL;
$conn->close();
