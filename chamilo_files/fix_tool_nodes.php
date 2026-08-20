<?php
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

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 1. Find all courses
    $stmt = $pdo->query("SELECT id, code, title, resource_node_id FROM course");
    $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($courses as $c) {
        $cId = (int) $c['id'];
        $courseNodeId = (int) $c['resource_node_id'];

        if (!$courseNodeId) {
            echo "Skipping course #$cId (no course node)\n";
            continue;
        }

        // Fetch tools for this course
        $stmtTools = $pdo->prepare("SELECT iid, tool_id, title, resource_node_id FROM c_tool WHERE c_id = ?");
        $stmtTools->execute([$cId]);
        $tools = $stmtTools->fetchAll(PDO::FETCH_ASSOC);

        echo "Processing course #$cId (" . $c['title'] . ") with " . count($tools) . " tools...\n";

        foreach ($tools as $t) {
            $iid = (int) $t['iid'];
            $toolId = (int) $t['tool_id'];
            $toolTitle = $t['title'];
            $existingNodeId = (int) $t['resource_node_id'];

            if ($existingNodeId > 0) {
                continue; // Node already exists
            }

            // Create tool ResourceNode
            $v4 = Uuid::v4();
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $toolTitle), '-'));

            $stmtNode = $pdo->prepare("
                INSERT INTO resource_node (
                    resource_type_id, creator_id, parent_id, title, slug, level, created_at, updated_at, public, uuid
                ) VALUES (
                    ?, 1, ?, ?, ?, 2, NOW(), NOW(), 1, ?
                )
            ");
            $stmtNode->execute([$toolId, $courseNodeId, $toolTitle, $slug, $v4->toBinary()]);
            $nodeId = (int) $pdo->lastInsertId();

            $path = 'course-' . $cId . '/' . $slug . '-' . $nodeId . '/';
            $pdo->prepare("UPDATE resource_node SET path = ? WHERE id = ?")->execute([$path, $nodeId]);

            // Update c_tool with resource_node_id
            $pdo->prepare("UPDATE c_tool SET resource_node_id = ? WHERE iid = ?")->execute([$nodeId, $iid]);

            echo "  -> Tool '$toolTitle' linked to ResourceNode #$nodeId\n";
        }
    }

    echo "\n✅ All course tools successfully linked to ResourceNodes!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
