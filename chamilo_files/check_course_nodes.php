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

$pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== CHECK COURSE ROOT RESOURCE NODES ===\n";
$courses = $pdo->query("SELECT id, code, title, resource_node_id FROM course LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
foreach ($courses as $c) {
    $rn = $pdo->query("SELECT id, resource_type_id, parent_id, title FROM resource_node WHERE id = " . (int)$c['resource_node_id'])->fetch(PDO::FETCH_ASSOC);
    echo "Course {$c['id']} ({$c['title']}) -> node {$c['resource_node_id']}: " . ($rn ? "FOUND (type {$rn['resource_type_id']}, title '{$rn['title']}')" : "MISSING!") . "\n";
}
