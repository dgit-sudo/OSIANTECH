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

    // Let's find user dgitsudo@gmail.com
    $stmt = $pdo->prepare("SELECT id, email, username FROM user WHERE email = ? LIMIT 1");
    $stmt->execute(['dgitsudo@gmail.com']);
    $userRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$userRow) {
        echo "❌ User dgitsudo@gmail.com not found in Chamilo!\n";
        exit;
    }

    $userId = (int) $userRow['id'];
    echo "Found user: ID $userId (" . $userRow['email'] . ")\n";

    // 1. Ensure course exists
    $code = 'OSIAN_1';
    $title = 'Oracle Admin I';

    $stmt = $pdo->prepare("SELECT id FROM course WHERE code = ? LIMIT 1");
    $stmt->execute([$code]);
    $courseRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($courseRow && !empty($courseRow['id'])) {
        $courseId = (int) $courseRow['id'];
        echo "Course already exists: ID $courseId\n";
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO course (
                code, title, visual_code, directory,
                course_language, visibility, video_url,
                sticky, creation_date, subscribe, unsubscribe, popularity
            ) VALUES (
                ?, ?, ?, ?,
                'english', 3, '',
                0, NOW(), 1, 0, 0
            )
        ");
        $stmt->execute([$code, $title, $code, $code]);
        $courseId = (int) $pdo->lastInsertId();
        echo "Created new course: ID $courseId\n";
    }

    // 2. Link course to Access URL (portal)
    try {
        $pdo->exec("INSERT INTO access_url_rel_course (access_url_id, c_id) VALUES (1, $courseId) ON DUPLICATE KEY UPDATE c_id = $courseId");
        echo "Linked course to access_url 1\n";
    } catch (Exception $e) {
        echo "Note access_url_rel_course: " . $e->getMessage() . "\n";
    }

    // 3. Enroll user into course_rel_user
    $stmt = $pdo->prepare("
        INSERT INTO course_rel_user (
            c_id, user_id, relation_type, status, progress
        ) VALUES (
            ?, ?, 0, 5, 0
        )
        ON DUPLICATE KEY UPDATE status = 5
    ");
    $stmt->execute([$courseId, $userId]);
    echo "✅ Enrolled user $userId into course $courseId (Oracle Admin I) successfully!\n";

    // Show enrollments
    $stmt = $pdo->query("
        SELECT c.id, c.code, c.title, u.email, cru.status 
        FROM course_rel_user cru
        JOIN course c ON c.id = cru.c_id
        JOIN user u ON u.id = cru.user_id
        WHERE cru.user_id = $userId
    ");
    echo "\n--- CURRENT ENROLLMENTS FOR USER $userId ---\n";
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "Course #" . $row['id'] . " (" . $row['code'] . " - " . $row['title'] . ") Status: " . $row['status'] . "\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
