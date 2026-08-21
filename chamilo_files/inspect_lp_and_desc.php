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

    echo "=== 1. COURSE DESCRIPTION FOR CID=6 ===\n";
    $stmt = $pdo->query("SELECT * FROM c_course_description WHERE c_id = 6");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 2. LEARNING PATH FOR CID=6 ===\n";
    $stmtLp = $pdo->query("SELECT * FROM c_lp WHERE c_id = 6");
    print_r($stmtLp->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 3. RESOURCE LINKS FOR CID=6 ===\n";
    $stmtRl = $pdo->query("
        SELECT rl.id, rl.resource_node_id, rl.c_id, rl.visibility, rl.resource_type_group, rn.title, rt.title as type_title
        FROM resource_link rl
        JOIN resource_node rn ON rn.id = rl.resource_node_id
        LEFT JOIN resource_type rt ON rt.id = rn.resource_type_id
        WHERE rl.c_id = 6
    ");
    print_r($stmtRl->fetchAll(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
