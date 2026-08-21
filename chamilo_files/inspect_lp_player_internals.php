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

    echo "=== 1. ALL LP ITEMS FOR LP 1 (COURSE 6) ===\n";
    $stmt = $pdo->query("SELECT iid, lp_id, item_type, title, path, ref, display_order, previous_item_id, next_item_id, parent_item_id FROM c_lp_item WHERE lp_id = 1 ORDER BY iid ASC");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 2. ALL COURSE DESCRIPTIONS FOR COURSE 6 ===\n";
    $stmtCd = $pdo->query("
        SELECT cd.iid, cd.resource_node_id, cd.title, cd.description_type, rn.parent_id 
        FROM c_course_description cd
        JOIN resource_node rn ON rn.id = cd.resource_node_id
        WHERE rn.parent_id = 144
    ");
    print_r($stmtCd->fetchAll(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
