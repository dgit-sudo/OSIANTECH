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

    echo "=== COURSE RECORD FOR OSIAN_1 ===\n";
    $stmt = $pdo->query("SELECT * FROM course WHERE code = 'OSIAN_1'");
    $course = $stmt->fetch(PDO::FETCH_ASSOC);
    print_r($course);

    if ($course) {
        $cId = (int) $course['id'];

        echo "\n=== TOOLS IN C_TOOL FOR COURSE #$cId ===\n";
        $stmt = $pdo->prepare("SELECT * FROM c_tool WHERE c_id = ?");
        $stmt->execute([$cId]);
        $tools = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "Found " . count($tools) . " tools in c_tool.\n";
        foreach ($tools as $t) {
            print_r($t);
        }

        echo "\n=== ENROLLMENTS IN COURSE_REL_USER FOR COURSE #$cId ===\n";
        $stmt = $pdo->prepare("
            SELECT cru.*, u.username, u.email 
            FROM course_rel_user cru 
            JOIN user u ON u.id = cru.user_id 
            WHERE cru.c_id = ?
        ");
        $stmt->execute([$cId]);
        $enrollments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($enrollments as $e) {
            echo "User #" . $e['user_id'] . " (" . $e['email'] . ") Status: " . $e['status'] . "\n";
        }
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
