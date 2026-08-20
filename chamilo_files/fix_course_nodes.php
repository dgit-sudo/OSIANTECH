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

    echo "--- RESOURCE_NODE TABLE COLUMNS ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM resource_node");
    while ($col = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $col['Field'] . " (" . $col['Type'] . ") - Null: " . $col['Null'] . "\n";
    }

    echo "\n--- RESOURCE_TYPE TABLE ---\n";
    try {
        $stmt = $pdo->query("SELECT * FROM resource_type");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            print_r($row);
        }
    } catch (Exception $e) {
        echo "No resource_type table: " . $e->getMessage() . "\n";
    }

    echo "\n--- EXISTING RESOURCE NODES (SAMPLE) ---\n";
    $stmt = $pdo->query("SELECT * FROM resource_node LIMIT 3");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
