<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$dbUrl = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL') ?? '';
$parts = parse_url($dbUrl);
$host = $parts['host'] ?? '127.0.0.1';
$port = $parts['port'] ?? 3306;
$user = $parts['user'] ?? 'root';
$pass = $parts['pass'] ?? '';
$db   = ltrim($parts['path'] ?? '', '/');

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    echo "=== 1. RESOURCE NODE DETAILS FOR 144 AND 172 ===\n";
    $stmt = $pdo->query("
        SELECT id, title, parent_id, resource_type_id 
        FROM resource_node 
        WHERE id IN (144, 172, 84, 7341) OR parent_id IN (144, 172)
    ");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 2. RESOURCE LINK ENTRIES FOR 144, 172, AND COURSE 6 ===\n";
    $stmt2 = $pdo->query("
        SELECT rl.*, rn.title as node_title 
        FROM resource_link rl
        JOIN resource_node rn ON rn.id = rl.resource_node_id
        WHERE rl.resource_node_id IN (144, 172) OR rl.c_id = 6
    ");
    print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
