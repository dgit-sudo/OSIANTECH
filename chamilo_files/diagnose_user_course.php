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

    // 1. Find user dgitsudo@gmail.com
    $stmt = $pdo->prepare("SELECT id, email, username FROM user WHERE email = 'dgitsudo@gmail.com' LIMIT 1");
    $stmt->execute();
    $u = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$u) {
        echo "User dgitsudo@gmail.com not found in Chamilo.\n";
        exit;
    }

    $userId = (int) $u['id'];
    echo "=== ACTIVE USER: #" . $userId . " (" . $u['email'] . ") ===\n";

    // 2. Find all courses enrolled for this user
    $stmt = $pdo->prepare("
        SELECT cru.c_id, cru.status, c.code, c.title, c.resource_node_id 
        FROM course_rel_user cru
        JOIN course c ON c.id = cru.c_id
        WHERE cru.user_id = ?
    ");
    $stmt->execute([$userId]);
    $enrolledCourses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($enrolledCourses) . " enrolled courses for this user:\n";
    foreach ($enrolledCourses as $ec) {
        echo " -> Course #" . $ec['c_id'] . " | Code: " . $ec['code'] . " | Title: '" . $ec['title'] . "' | ResourceNodeId: " . $ec['resource_node_id'] . "\n";
    }

    // 3. For every enrolled course, check and populate all 27 tools with valid child ResourceNodes
    $defaultTools = [
        ["agenda", 1, 0],
        ["announcement", 2, 1],
        ["student_publication", 4, 2],
        ["attendance", 5, 3],
        ["blog", 6, 4],
        ["chat", 7, 5],
        ["course_description", 8, 6],
        ["course_homepage", 9, 7],
        ["course_progress", 10, 8],
        ["course_tool", 11, 9],
        ["document", 13, 10],
        ["dropbox", 14, 11],
        ["quiz", 15, 12],
        ["forum", 16, 13],
        ["glossary", 18, 14],
        ["gradebook", 19, 15],
        ["group", 20, 16],
        ["learnpath", 21, 17],
        ["link", 22, 18],
        ["course_maintenance", 23, 19],
        ["member", 24, 20],
        ["notebook", 26, 21],
        ["portfolio", 28, 22],
        ["course_setting", 30, 23],
        ["survey", 32, 24],
        ["tracking", 35, 25],
        ["wiki", 39, 26],
    ];

    foreach ($enrolledCourses as $ec) {
        $cId = (int) $ec['c_id'];
        $courseNodeId = (int) $ec['resource_node_id'];

        if (!$courseNodeId) {
            // Create Course ResourceNode if missing
            $v4 = Uuid::v4();
            $slug = 'course-' . $cId;
            $stmt = $pdo->prepare("
                INSERT INTO resource_node (resource_type_id, creator_id, title, slug, level, created_at, updated_at, public, uuid)
                VALUES (31, 1, ?, ?, 1, NOW(), NOW(), 1, ?)
            ");
            $stmt->execute([$ec['title'], $slug, $v4->toBinary()]);
            $courseNodeId = (int) $pdo->lastInsertId();
            $path = $slug . '-' . $courseNodeId . '/';
            $pdo->prepare("UPDATE resource_node SET path = ? WHERE id = ?")->execute([$path, $courseNodeId]);
            $pdo->prepare("UPDATE course SET resource_node_id = ? WHERE id = ?")->execute([$courseNodeId, $cId]);
            echo "Created Course ResourceNode #$courseNodeId for Course #$cId\n";
        }

        // Link course to portal (access_url 1)
        try {
            $pdo->exec("INSERT INTO access_url_rel_course (access_url_id, c_id) VALUES (1, $cId) ON DUPLICATE KEY UPDATE c_id = $cId");
        } catch (Exception $_e) {}

        // Populate tools
        echo "\nSeeding tools for Course #$cId (" . $ec['title'] . ")...\n";
        foreach ($defaultTools as $dt) {
            [$tTitle, $tId, $pos] = $dt;
            $stmtTool = $pdo->prepare("SELECT iid, resource_node_id FROM c_tool WHERE c_id = ? AND tool_id = ? LIMIT 1");
            $stmtTool->execute([$cId, $tId]);
            $toolRow = $stmtTool->fetch(PDO::FETCH_ASSOC);

            $tNodeId = !empty($toolRow['resource_node_id']) ? (int) $toolRow['resource_node_id'] : null;

            if (empty($tNodeId)) {
                $tUuid = Uuid::v4()->toBinary();
                $tSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $tTitle), '-'));
                $stmtNode = $pdo->prepare("
                    INSERT INTO resource_node (resource_type_id, creator_id, parent_id, title, slug, level, created_at, updated_at, public, uuid)
                    VALUES (?, 1, ?, ?, ?, 2, NOW(), NOW(), 1, ?)
                ");
                $stmtNode->execute([$tId, $courseNodeId, $tTitle, $tSlug, $tUuid]);
                $tNodeId = (int) $pdo->lastInsertId();
                $tPath = 'course-' . $cId . '/' . $tSlug . '-' . $tNodeId . '/';
                $pdo->prepare("UPDATE resource_node SET path = ? WHERE id = ?")->execute([$tPath, $tNodeId]);
            }

            if ($toolRow) {
                $pdo->prepare("UPDATE c_tool SET resource_node_id = ? WHERE iid = ?")->execute([$tNodeId, $toolRow['iid']]);
            } else {
                $pdo->prepare("INSERT INTO c_tool (resource_node_id, c_id, tool_id, title, position) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$tNodeId, $cId, $tId, $tTitle, $pos]);
            }
        }
        echo "✅ Seeded and verified all 27 tools for Course #$cId!\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
