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

echo "=== 1. ALL LPs FOR COURSE 6 ===\n";
$stmt = $pdo->query("
    SELECT clp.iid, clp.title, clp.resource_node_id, rn.parent_id, rn.resource_type_id, rl.id as link_id, rl.c_id, rl.visibility
    FROM c_lp clp
    LEFT JOIN resource_node rn ON rn.id = clp.resource_node_id
    LEFT JOIN resource_link rl ON rl.resource_node_id = rn.id
    WHERE rl.c_id = 6 OR rn.parent_id = 144
");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== 2. ALL RESOURCE NODES WITH resource_type_id = 39 (LPs) FOR COURSE 6 (parent_id = 144) ===\n";
$stmt = $pdo->query("
    SELECT rn.id, rn.title, rn.parent_id, rn.resource_type_id, rl.id as link_id, rl.c_id, rl.visibility
    FROM resource_node rn
    LEFT JOIN resource_link rl ON rl.resource_node_id = rn.id
    WHERE rn.parent_id = 144 OR rl.c_id = 6
");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== 3. ALL LP ITEMS FOR LP(s) OF COURSE 6 ===\n";
$stmt = $pdo->query("
    SELECT iid, lp_id, item_type, title, path, ref, display_order, parent_item_id, previous_item_id, next_item_id
    FROM c_lp_item
    ORDER BY lp_id, display_order
");
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Total items across all LPs: " . count($items) . "\n";
print_r(array_slice($items, 0, 20));

echo "\n=== 4. TOTAL ROWS IN TABLES ===\n";
echo "c_lp: " . $pdo->query("SELECT count(*) FROM c_lp")->fetchColumn() . "\n";
echo "c_lp_item: " . $pdo->query("SELECT count(*) FROM c_lp_item")->fetchColumn() . "\n";
echo "c_document: " . $pdo->query("SELECT count(*) FROM c_document")->fetchColumn() . "\n";
echo "resource_node: " . $pdo->query("SELECT count(*) FROM resource_node")->fetchColumn() . "\n";
echo "resource_link: " . $pdo->query("SELECT count(*) FROM resource_link")->fetchColumn() . "\n";
