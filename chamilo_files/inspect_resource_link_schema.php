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

    echo "=== SCHEMA FOR resource_link ===\n";
    $stmt = $pdo->query("DESCRIBE resource_link");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "  " . str_pad($r['Field'], 25) . " " . $r['Type'] . "\n";
    }

    echo "\n=== EXISTING ROWS IN resource_link ===\n";
    $stmt = $pdo->query("SELECT * FROM resource_link LIMIT 10");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($r);
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
