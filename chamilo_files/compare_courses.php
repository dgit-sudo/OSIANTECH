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

    echo "=== COMPARING ALL COURSES IN DB ===\n";
    $stmt = $pdo->query("SELECT * FROM course");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "----------------------------------------\n";
        echo "ID: " . $r['id'] . "\n";
        echo "Code: " . $r['code'] . "\n";
        echo "Title: " . $r['title'] . "\n";
        echo "Directory: " . $r['directory'] . "\n";
        echo "ResourceNodeId: " . $r['resource_node_id'] . "\n";
    }

    echo "\n=== CHECKING COURSE DIRECTORIES ON DISK ===\n";
    $paths = [
        '/var/www/html/chamilo/app/courses',
        '/var/www/html/chamilo/var/courses',
        '/var/www/html/chamilo/public/courses',
        '/var/www/html/chamilo/courses',
        '/var/www/html/chamilo/var/upload'
    ];
    foreach ($paths as $p) {
        if (is_dir($p)) {
            echo "Directory exists: $p\n";
            $items = scandir($p);
            echo "  Contents: " . implode(', ', array_slice($items, 0, 15)) . "\n";
        }
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
