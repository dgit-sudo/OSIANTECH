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

echo "=== 1. CHECKING VAR/LOG/PROD.LOG (LATEST 60 LINES) ===\n";
$prodLog = '/var/www/html/chamilo/var/log/prod.log';
if (file_exists($prodLog)) {
    $lines = file($prodLog);
    echo implode('', array_slice($lines, -60));
} else {
    echo "prod.log not found.\n";
}

echo "\n=== 2. CHECKING VAR/LOG/DEV.LOG (LATEST 60 LINES) ===\n";
$devLog = '/var/www/html/chamilo/var/log/dev.log';
if (file_exists($devLog)) {
    $lines = file($devLog);
    echo implode('', array_slice($lines, -60));
} else {
    echo "dev.log not found.\n";
}

echo "\n=== 3. NGINX ERROR LOG ===\n";
$nginxErr = '/var/log/nginx/error.log';
if (file_exists($nginxErr)) {
    $lines = file($nginxErr);
    echo implode('', array_slice($lines, -30));
}

echo "\n=== 4. TEST RESOLVING A DOCUMENT IN DOCTRINE ===\n";
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

    $stmt = $pdo->query("
        SELECT cd.iid, cd.title, cd.filetype, rf.original_name, rf.title as rf_title, rf.mime_type, rn.id as node_id, rn.uuid
        FROM c_document cd
        LEFT JOIN resource_node rn ON rn.id = cd.resource_node_id
        LEFT JOIN resource_file rf ON rf.resource_node_id = rn.id
        LIMIT 3
    ");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
