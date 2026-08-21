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

echo "=== 1. ALL c_lp ROWS IN DATABASE ===\n";
$lps = $pdo->query("SELECT iid, title, resource_node_id FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = 144 OR id = 144 OR parent_id = 12635 OR id = 12635) OR iid IN (1, 249, 497, 498)")->fetchAll(PDO::FETCH_ASSOC);
print_r($lps);

echo "\n=== 2. ALL RESOURCE NODES WITH resource_type_id = 39 (OR parent_id = 144/12635) ===\n";
$nodes = $pdo->query("SELECT rn.id, rn.title, rn.resource_type_id, rn.parent_id, rl.visibility, rl.c_id FROM resource_node rn LEFT JOIN resource_link rl ON rl.resource_node_id = rn.id WHERE rn.resource_type_id = 39 OR rn.parent_id IN (144, 12635) OR rn.id IN (144, 12635)")->fetchAll(PDO::FETCH_ASSOC);
print_r($nodes);

echo "\n=== 3. SEARCH SOURCE FOR LP LIST QUERY IN REPO ===\n";
$lines = file('/var/www/html/chamilo/src/CourseBundle/Repository/CLpRepository.php');
echo implode('', array_slice($lines, 0, 70));
