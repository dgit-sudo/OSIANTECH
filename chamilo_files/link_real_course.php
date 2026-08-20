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

    // 1. Clean up duplicate mock course #3
    $pdo->exec("DELETE FROM c_tool WHERE c_id = 3");
    $pdo->exec("DELETE FROM course_rel_user WHERE c_id = 3");
    $pdo->exec("DELETE FROM access_url_rel_course WHERE c_id = 3");
    $pdo->exec("DELETE FROM course WHERE id = 3");
    echo "✅ Cleaned up empty mock course #3.\n";

    // 2. Ensure real course #2 (OSIAN1 - Oracle Admin I) has visual_code and portal link
    $pdo->exec("UPDATE course SET code = 'OSIAN_1', visual_code = 'OSIAN_1' WHERE id = 2");
    $pdo->exec("INSERT INTO access_url_rel_course (access_url_id, c_id) VALUES (1, 2) ON DUPLICATE KEY UPDATE c_id = 2");
    echo "✅ Real Course #2 is now canonical 'OSIAN_1' (Oracle Admin I)!\n";

    // 3. Find user dgitsudo@gmail.com
    $stmt = $pdo->prepare("SELECT id, email FROM user WHERE email = 'dgitsudo@gmail.com' LIMIT 1");
    $stmt->execute();
    $u = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($u) {
        $uId = (int) $u['id'];
        $pdo->prepare("
            INSERT INTO course_rel_user (c_id, user_id, relation_type, status, progress)
            VALUES (2, ?, 0, 5, 0)
            ON DUPLICATE KEY UPDATE status = 5
        ")->execute([$uId]);
        echo "✅ Subscribed user #" . $uId . " (" . $u['email'] . ") to real Course #2 (Oracle Admin I) with all 27 tools!\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
