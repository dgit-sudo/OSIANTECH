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
echo "Database URL: " . preg_replace('/:([^:@]+)@/', ':****@', $dbUrl) . "\n";

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
    echo "✅ Connected to Chamilo MySQL database successfully!\n";

    echo "\n--- COURSE TABLE COLUMNS ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM course");
    while ($col = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $col['Field'] . " (" . $col['Type'] . ") - Null: " . $col['Null'] . "\n";
    }

    echo "\n--- COURSE_REL_USER TABLE COLUMNS ---\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM course_rel_user");
    while ($col = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $col['Field'] . " (" . $col['Type'] . ") - Null: " . $col['Null'] . "\n";
    }

    echo "\n--- RECENT USERS IN CHAMILO ---\n";
    $stmt = $pdo->query("SELECT id, username, email, status, active FROM user ORDER BY id DESC LIMIT 5");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "User #" . $row['id'] . " | " . $row['username'] . " | " . $row['email'] . "\n";
    }

    echo "\n--- RECENT COURSES IN CHAMILO ---\n";
    $stmt = $pdo->query("SELECT id, code, title FROM course ORDER BY id DESC LIMIT 5");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "Course #" . $row['id'] . " | Code: " . $row['code'] . " | Title: " . $row['title'] . "\n";
    }

    echo "\n--- RECENT ENROLLMENTS IN CHAMILO (course_rel_user) ---\n";
    $stmt = $pdo->query("SELECT * FROM course_rel_user ORDER BY user_id DESC LIMIT 5");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
