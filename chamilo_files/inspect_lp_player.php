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

echo "=== 1. CHECK c_lp FOR COURSE 6 ===\n";
$stmt = $pdo->query("SELECT * FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = 144)");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== 2. CHECK c_document FOR LP ITEMS OF COURSE 6 ===\n";
$stmt = $pdo->query("
    SELECT cd.*, rn.id as node_id, rn.uuid, rf.title as rf_title, rf.original_name, rf.mime_type, rf.size
    FROM c_document cd
    JOIN resource_node rn ON rn.id = cd.resource_node_id
    LEFT JOIN resource_file rf ON rf.resource_node_id = rn.id
    WHERE cd.iid IN (SELECT path FROM c_lp_item WHERE lp_id = 249)
");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== 3. TRACE LP PLAYER CONTROLLER / VIEW IN SOURCE ===\n";
$files = [
    '/var/www/html/chamilo/public/main/lp/lp_view.php',
    '/var/www/html/chamilo/public/main/lp/lp_controller.php',
    '/var/www/html/chamilo/public/main/lp/lp_content.php'
];

foreach ($files as $f) {
    if (file_exists($f)) {
        echo "File: $f (size: " . filesize($f) . ")\n";
    }
}
