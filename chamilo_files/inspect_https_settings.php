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

echo "=== 1. access_url TABLE ===\n";
$accessUrls = $pdo->query("SELECT * FROM access_url")->fetchAll(PDO::FETCH_ASSOC);
print_r($accessUrls);

echo "\n=== 2. settings TABLE FOR URL/HTTPS/PROTOCOL ===\n";
$settings = $pdo->query("SELECT * FROM settings WHERE variable LIKE '%url%' OR variable LIKE '%proto%' OR variable LIKE '%http%' OR variable LIKE '%ssl%' OR variable LIKE '%host%' OR variable LIKE '%root%'")->fetchAll(PDO::FETCH_ASSOC);
print_r($settings);

echo "\n=== 3. .env and .env.local FILES ===\n";
if (file_exists('/var/www/html/chamilo/.env')) {
    echo "--- .env ---\n" . file_get_contents('/var/www/html/chamilo/.env') . "\n";
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    echo "--- .env.local ---\n" . file_get_contents('/var/www/html/chamilo/.env.local') . "\n";
}
