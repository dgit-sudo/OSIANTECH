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

    $tables = ['c_lp', 'c_lp_item', 'c_course_description', 'c_tool_intro', 'c_document'];
    foreach ($tables as $t) {
        echo "=== SCHEMA FOR $t ===\n";
        try {
            $stmt = $pdo->query("DESCRIBE $t");
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                echo "  " . str_pad($r['Field'], 25) . " " . $r['Type'] . " (Null: " . $r['Null'] . ")\n";
            }
        } catch (Exception $e) {
            echo "  Table $t does not exist or error: " . $e->getMessage() . "\n";
        }
        echo "\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
