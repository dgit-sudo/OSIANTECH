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

    echo "✅ Connected to Chamilo DB!\n";

    $code = 'OSIAN_1';
    $title = 'Oracle Admin I';
    $slug = 'oracle-admin-i';

    // 1. Check or clean existing course
    $stmt = $pdo->prepare("SELECT id FROM course WHERE code = ?");
    $stmt->execute([$code]);
    $courseRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($courseRow && !empty($courseRow['id'])) {
        $cId = (int) $courseRow['id'];
        echo "Found existing course #$cId\n";
    } else {
        // Create ResourceNode
        $v4 = Uuid::v4();
        $stmt = $pdo->prepare("
            INSERT INTO resource_node (
                resource_type_id, creator_id, title, slug, level, created_at, updated_at, public, uuid
            ) VALUES (
                31, 1, ?, ?, 1, NOW(), NOW(), 1, ?
            )
        ");
        $stmt->execute([$title, $slug, $v4->toBinary()]);
        $nodeId = (int) $pdo->lastInsertId();
        $path = $slug . '-' . $nodeId . '/';
        $pdo->prepare("UPDATE resource_node SET path = ? WHERE id = ?")->execute([$path, $nodeId]);

        // Create Course
        $stmt = $pdo->prepare("
            INSERT INTO course (
                resource_node_id, code, title, visual_code, directory,
                course_language, visibility, video_url, sticky,
                creation_date, subscribe, unsubscribe, popularity
            ) VALUES (
                ?, ?, ?, ?, ?,
                'english', 3, '', 0,
                NOW(), 1, 0, 0
            )
        ");
        $stmt->execute([$nodeId, $code, $title, $code, $code]);
        $cId = (int) $pdo->lastInsertId();
        echo "✅ Created course #$cId ('$title') with ResourceNode #$nodeId\n";
    }

    // 2. Link to Access URL 1 (Portal)
    try {
        $pdo->exec("INSERT INTO access_url_rel_course (access_url_id, c_id) VALUES (1, $cId) ON DUPLICATE KEY UPDATE c_id = $cId");
        echo "Linked course #$cId to access_url 1\n";
    } catch (Exception $e) {
        echo "Access URL: " . $e->getMessage() . "\n";
    }

    // 3. Seed standard course tools into c_tool
    $defaultTools = [
        ['course_homepage', 9, 1],
        ['document', 13, 2],
        ['learnpath', 21, 3],
        ['quiz', 15, 4],
        ['announcement', 2, 5],
        ['student_publication', 4, 6],
        ['forum', 16, 7],
        ['link', 22, 8],
        ['course_description', 8, 9],
        ['user', 17, 10],
        ['gradebook', 19, 11],
        ['attendance', 5, 12],
    ];

    foreach ($defaultTools as $dt) {
        [$toolTitle, $toolId, $pos] = $dt;
        try {
            $pdo->prepare("
                INSERT INTO c_tool (c_id, tool_id, title, position)
                VALUES (?, ?, ?, ?)
            ")->execute([$cId, $toolId, $toolTitle, $pos]);
        } catch (Exception $_e) {
            // Already exists
        }
    }
    echo "✅ Seeded " . count($defaultTools) . " standard tools into c_tool for course #$cId\n";

    // 4. Enroll all student users into course_rel_user with status = 5
    $stmt = $pdo->query("SELECT id, email, username FROM user WHERE email != 'admin@osian.tech'");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as $u) {
        $uId = (int) $u['id'];
        $pdo->prepare("
            INSERT INTO course_rel_user (c_id, user_id, relation_type, status, progress)
            VALUES (?, ?, 0, 5, 0)
            ON DUPLICATE KEY UPDATE status = 5
        ")->execute([$cId, $uId]);
        echo "✅ Enrolled user #$uId (" . $u['email'] . ") into course #$cId as Student!\n";
    }

    echo "\n🎉 Course #$cId ('$title') setup complete with full tools and active student enrollment!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
