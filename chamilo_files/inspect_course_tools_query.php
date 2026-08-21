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

echo "=== 1. c_tool TABLE FOR COURSE 6 ===\n";
if ($pdo->query("SHOW TABLES LIKE 'c_tool'")->fetchColumn()) {
    $tools = $pdo->query("SELECT * FROM c_tool WHERE c_id = 6")->fetchAll(PDO::FETCH_ASSOC);
    print_r($tools);
} else {
    echo "No c_tool table\n";
}

echo "\n=== 2. ALL RESOURCE NODES WITH parent_id = (course 6 root) ===\n";
$c6 = $pdo->query("SELECT id, resource_node_id FROM course WHERE id = 6")->fetch(PDO::FETCH_ASSOC);
$c6Node = $c6['resource_node_id'];
$nodes = $pdo->query("SELECT rn.id, rn.title, rn.resource_type_id, rn.parent_id, rl.visibility, rl.id as link_id FROM resource_node rn LEFT JOIN resource_link rl ON rl.resource_node_id = rn.id WHERE rn.parent_id = $c6Node OR rn.id = $c6Node")->fetchAll(PDO::FETCH_ASSOC);
print_r($nodes);

echo "\n=== 3. SEARCH SOURCE FOR COURSE HOME TOOLS QUERY ===\n";
$files = [
    '/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php',
    '/var/www/html/chamilo/src/CoreBundle/Repository/ToolRepository.php',
    '/var/www/html/chamilo/src/CoreBundle/Repository/ResourceRepository.php',
];
foreach ($files as $f) {
    if (file_exists($f)) {
        echo "Found: $f\n";
    }
}
