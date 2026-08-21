<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Uid\Uuid;
use Chamilo\CoreBundle\Framework\Container;

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

echo "=== TEST LP DOCUMENTS WITH PARENT_ID = LP_NODE_ID & VISIBILITY = 2 ===\n";

$courseId = 6;
$c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $courseId")->fetch(PDO::FETCH_ASSOC);
$rootNodeId = (int)$c['resource_node_id'];
$courseCode = $c['code'];

// Find LP node
$lpNodeId = $pdo->query("SELECT id FROM resource_node WHERE parent_id = $rootNodeId AND resource_type_id = 39 LIMIT 1")->fetchColumn();
echo "LP Node ID: $lpNodeId\n";

// Update all module document nodes for course 6 to have parent_id = $lpNodeId and visibility = 2
$pdo->exec("
    UPDATE resource_node rn
    JOIN resource_link rl ON rl.resource_node_id = rn.id
    SET rn.parent_id = $lpNodeId, rl.visibility = 2
    WHERE rl.c_id = $courseId AND rn.resource_type_id = 17
");

// Check visible documents in Documents tool (where parent_id = $rootNodeId)
$toolDocs = $pdo->query("
    SELECT rn.id, rn.title 
    FROM resource_node rn 
    JOIN resource_link rl ON rl.resource_node_id = rn.id
    WHERE rl.c_id = $courseId AND rn.parent_id = $rootNodeId AND rn.resource_type_id = 17 AND rl.visibility = 2
")->fetchAll(PDO::FETCH_ASSOC);

echo "Documents visible in course root Documents tool: " . count($toolDocs) . " (Expected: 0)\n";

// Test DocumentManager::get_document_data_by_id for first doc (doc ID 1246)
$firstDoc = $pdo->query("SELECT iid FROM c_document WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = $lpNodeId) LIMIT 1")->fetchColumn();
echo "Testing get_document_data_by_id for doc iid: $firstDoc...\n";

$docData = DocumentManager::get_document_data_by_id((int)$firstDoc, $courseCode);
echo "Document Data result: " . (is_array($docData) ? "SUCCESS (" . $docData['title'] . ")" : "FAILED") . "\n";
if (is_array($docData)) {
    print_r($docData);
}
