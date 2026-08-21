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

    echo "✅ Connected to Chamilo Database!\n";

    // 1. Find all courses
    $stmtCourses = $pdo->query("SELECT id, code, title, resource_node_id FROM course");
    $courses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

    echo "Publishing resources for " . count($courses) . " courses...\n";

    $stmtInsertLink = $pdo->prepare("
        INSERT INTO resource_link (
            resource_node_id, c_id, visibility, display_order, resource_type_group, created_at, updated_at
        ) VALUES (
            ?, ?, 2, ?, 0, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE visibility = 2, updated_at = NOW()
    ");

    $linkCount = 0;

    foreach ($courses as $c) {
        $cId = (int) $c['id'];
        $courseNodeId = (int) $c['resource_node_id'];

        if (!$courseNodeId) continue;

        // Course node itself
        $stmtInsertLink->execute([$courseNodeId, $cId, 1]);
        $linkCount++;

        // Find all child resource nodes belonging to this course
        $stmtChildren = $pdo->prepare("
            SELECT id FROM resource_node 
            WHERE parent_id = ? 
               OR id IN (SELECT resource_node_id FROM c_tool WHERE c_id = ?)
               OR id IN (SELECT resource_node_id FROM c_shortcut WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ?))
               OR id IN (SELECT resource_node_id FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ?))
               OR id IN (SELECT resource_node_id FROM c_document WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ?))
        ");
        $stmtChildren->execute([$courseNodeId, $cId, $courseNodeId, $courseNodeId, $courseNodeId]);
        $childNodes = $stmtChildren->fetchAll(PDO::FETCH_ASSOC);

        $order = 2;
        foreach ($childNodes as $cn) {
            $cnId = (int) $cn['id'];
            $stmtInsertLink->execute([$cnId, $cId, $order++]);
            $linkCount++;
        }
    }

    echo "✅ Successfully linked and published $linkCount resource nodes into resource_link with visibility = 2!\n";

    // 2. Ensure all student users are enrolled into their active purchases
    echo "\n=== ENROLLING ACTIVE USERS INTO PURCHASED COURSES ===\n";
    $stmtUsers = $pdo->query("SELECT id, email, username FROM user WHERE email != 'admin@osian.tech'");
    $users = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as $u) {
        $uId = (int) $u['id'];
        $email = $u['email'];

        try {
            $ctx = stream_context_create([
                "http" => ["timeout" => 5, "header" => "Accept: application/json\r\nUser-Agent: Chamilo-Publish/2.0\r\n"],
                "ssl"  => ["verify_peer" => false, "verify_peer_name" => false]
            ]);
            $url = "https://osian.tech/api/profile/by-email/lms-courses?email=" . urlencode($email);
            $raw = @file_get_contents($url, false, $ctx);
            if ($raw) {
                $pData = json_decode($raw, true);
                if (!empty($pData['courses'])) {
                    foreach ($pData['courses'] as $pc) {
                        $pCode = $pc['courseCode'] ?? ('OSIAN_' . $pc['courseId']);
                        $stmtFind = $pdo->prepare("SELECT id FROM course WHERE code = ? OR visual_code = ? LIMIT 1");
                        $stmtFind->execute([$pCode, $pCode]);
                        $foundC = $stmtFind->fetch(PDO::FETCH_ASSOC);
                        if ($foundC) {
                            $targetCId = (int) $foundC['id'];
                            $pdo->prepare("
                                INSERT INTO course_rel_user (c_id, user_id, relation_type, status, progress)
                                VALUES (?, ?, 0, 5, 0)
                                ON DUPLICATE KEY UPDATE status = 5
                            ")->execute([$targetCId, $uId]);
                            echo "✅ Enrolled user #" . $uId . " (" . $email . ") into Course #" . $targetCId . " (" . $pCode . ") as Student!\n";
                        }
                    }
                }
            }
        } catch (Exception $_e) {}
    }

    echo "\n🎉 COMPLETE: All course tools, learning paths, documents, and shortcuts are now fully published and visible!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
