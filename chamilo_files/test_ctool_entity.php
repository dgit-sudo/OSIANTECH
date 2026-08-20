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

    echo "=== ALL COURSES IN DB ===\n";
    $stmt = $pdo->query("SELECT id, code, title, resource_node_id FROM course");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "Course #" . $r['id'] . " | Code: " . $r['code'] . " | Title: " . $r['title'] . " | Node: " . $r['resource_node_id'] . "\n";
    }

    echo "\n=== C_TOOL ROWS IN DB ===\n";
    $stmt = $pdo->query("SELECT * FROM c_tool");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($r);
    }

    echo "\n=== CHECKING CTool ENTITY PROPERTIES ===\n";
    $toolEntityFile = '/var/www/html/chamilo/src/CoreBundle/Entity/CTool.php';
    if (file_exists($toolEntityFile)) {
        $lines = file($toolEntityFile);
        echo implode('', array_slice($lines, 0, 80));
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
