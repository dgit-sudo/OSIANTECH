<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Uid\Uuid;

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

echo "=== RESTORE C_TOOL RESOURCE NODES FOR COURSE 6 ===\n";

$courseId = 6;
$c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $courseId")->fetch(PDO::FETCH_ASSOC);
$rootNodeId = (int)$c['resource_node_id'];

$tools = $pdo->query("SELECT * FROM c_tool WHERE c_id = $courseId")->fetchAll(PDO::FETCH_ASSOC);

// Tool ID to Resource Type mapping (from resource_type table)
$toolTypeMap = [
    'course_description' => 13,
    'learnpath' => 39,
    'document' => 17,
    'announcement' => 2,
    'agenda' => 1,
    'quiz' => 15,
    'forum' => 16,
    'gradebook' => 34,
    'group' => 37,
    'chat' => 7,
    'link' => 41,
    'student_publication' => 4,
    'attendance' => 5,
    'glossary' => 33,
    'notebook' => 43,
    'survey' => 48,
    'wiki' => 56,
    'member' => 24,
    'course_setting' => 30,
    'course_maintenance' => 23,
    'tracking' => 35
];

foreach ($tools as $t) {
    $toolTitle = $t['title'];
    $nodeId = (int)$t['resource_node_id'];
    $typeId = $toolTypeMap[$toolTitle] ?? 11; // 11 is course_tool
    
    $nodeExists = $pdo->query("SELECT id FROM resource_node WHERE id = $nodeId")->fetchColumn();
    
    if (!$nodeExists) {
        $uuid = Uuid::v4()->toBinary();
        $slug = 'c' . $courseId . '-tool-' . $toolTitle . '-' . substr(md5(uniqid()), 0, 4);
        
        // Insert with exact node ID if possible, or new ID and update c_tool
        try {
            $stmt = $pdo->prepare("INSERT INTO resource_node (id, uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, 0, ?, NOW(), NOW())");
            $stmt->execute([$nodeId, $uuid, $typeId, $toolTitle, $slug, $rootNodeId]);
            echo "Restored node $nodeId for tool '$toolTitle'\n";
        } catch (Exception $e) {
            $stmt = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, ?, ?, ?, 0, ?, NOW(), NOW())");
            $stmt->execute([$uuid, $typeId, $toolTitle, $slug, $rootNodeId]);
            $newNodeId = (int)$pdo->lastInsertId();
            $pdo->prepare("UPDATE c_tool SET resource_node_id = ? WHERE iid = ?")->execute([$newNodeId, $t['iid']]);
            $nodeId = $newNodeId;
            echo "Created new node $nodeId for tool '$toolTitle'\n";
        }
    } else {
        $pdo->prepare("UPDATE resource_node SET parent_id = ?, resource_type_id = ? WHERE id = ?")->execute([$rootNodeId, $typeId, $nodeId]);
    }
    
    // Ensure resource link exists with visibility = 2
    $linkId = $pdo->query("SELECT id FROM resource_link WHERE resource_node_id = $nodeId AND c_id = $courseId")->fetchColumn();
    if (!$linkId) {
        $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, ?, 0, ?, NOW(), NOW())")->execute([$nodeId, $t['position'], $courseId]);
    } else {
        $pdo->prepare("UPDATE resource_link SET visibility = 2 WHERE id = ?")->execute([$linkId]);
    }
}

echo "\n=== CHECK API C_TOOLS RESPONSE FOR COURSE 6 ===\n";
$output = shell_exec('curl -s -k https://localhost/api/c_tools?cid=6');
echo substr($output, 0, 500) . "\n";
