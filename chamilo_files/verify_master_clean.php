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

echo "=== CHAMILO 2.0 SYSTEM VERIFICATION ===\n";

$sampleCourseIds = [1, 6, 25, 50, 100, 150, 200, 248];

foreach ($sampleCourseIds as $cid) {
    echo "\n--- Course ID: $cid ---\n";
    $c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $cid")->fetch(PDO::FETCH_ASSOC);
    if (!$c) {
        echo "Course not found\n";
        continue;
    }
    echo "Title: " . $c['title'] . "\n";
    
    // Check descriptions
    $descs = $pdo->query("SELECT iid, title, resource_node_id FROM c_course_description WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = {$c['resource_node_id']} OR id = {$c['resource_node_id']})")->fetchAll(PDO::FETCH_ASSOC);
    echo "Descriptions count: " . count($descs) . " (Expected: 1)\n";
    
    // Check visible documents in Documents tool (visibility = 2)
    $docs = $pdo->query("SELECT rl.id FROM resource_link rl JOIN resource_node rn ON rn.id = rl.resource_node_id WHERE rl.c_id = $cid AND rn.resource_type_id = 17 AND rl.visibility = 2")->fetchAll(PDO::FETCH_ASSOC);
    echo "Visible documents in tool: " . count($docs) . " (Expected: 0 - completely clean)\n";
    
    // Check LP
    $lp = $pdo->query("SELECT iid, title FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = {$c['resource_node_id']}) LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    if ($lp) {
        echo "Learning Path: ID {$lp['iid']} - {$lp['title']}\n";
        $items = $pdo->query("SELECT iid, title, item_type, path, display_order FROM c_lp_item WHERE lp_id = {$lp['iid']} ORDER BY display_order ASC")->fetchAll(PDO::FETCH_ASSOC);
        echo "LP Items count: " . count($items) . " (Expected: 5)\n";
        foreach ($items as $it) {
            echo "   [#{$it['display_order']}] {$it['title']} (docId: {$it['path']})\n";
        }
    } else {
        echo "❌ No LP found!\n";
    }
}
