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

    // 1. Wipe test auto-enrollments
    $pdo->exec("DELETE FROM course_rel_user");
    echo "✅ Cleared all temporary test enrollments from course_rel_user.\n";

    // 2. Check what routes Chamilo has for courses
    echo "\n=== CHECKING CHAMILO COURSE ROUTING CONTROLLER ===\n";
    $cmd = 'grep -rn "public function " /var/www/html/chamilo/src/CoreBundle/Controller/Course/ /var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php 2>/dev/null | head -n 30';
    exec($cmd, $output);
    foreach ($output as $line) {
        echo $line . "\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
