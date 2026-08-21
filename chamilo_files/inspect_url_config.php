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

echo "=== ACCESS_URL ===\n";
print_r($pdo->query("SELECT * FROM access_url")->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== SETTINGS WHERE variable = 'institution_url' OR variable = 'campus_url' OR variable = 'root_web' ===\n";
print_r($pdo->query("SELECT * FROM settings WHERE variable IN ('institution_url', 'campus_url', 'root_web', 'server_type', 'force_ssl_all')")->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== CONFIGURATION / SYSTEM INFO ===\n";
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
echo "api_get_path(WEB_PATH): " . api_get_path(WEB_PATH) . "\n";
echo "api_get_path(WEB_AJAX_PATH): " . api_get_path(WEB_AJAX_PATH) . "\n";
