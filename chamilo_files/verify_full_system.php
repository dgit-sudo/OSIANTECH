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

    echo "=== 1. VERIFYING LEARNING PATH ITEMS (c_lp_item) ===\n";
    $stmt = $pdo->query("
        SELECT lp.iid as lp_id, lp.title as lp_title, count(lpi.iid) as item_count 
        FROM c_lp lp 
        LEFT JOIN c_lp_item lpi ON lpi.lp_id = lp.iid 
        GROUP BY lp.iid, lp.title 
        LIMIT 5
    ");
    $lps = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lps as $lp) {
        echo "LP #" . $lp['lp_id'] . " ('" . $lp['lp_title'] . "') -> " . $lp['item_count'] . " items\n";
    }

    echo "\n=== 2. SAMPLE MODULE ITEMS FOR LP #1 ===\n";
    $stmt = $pdo->query("SELECT iid, title, item_type, description, display_order FROM c_lp_item WHERE lp_id = 1 ORDER BY display_order ASC");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "  [" . $r['display_order'] . "] " . $r['title'] . " (" . $r['item_type'] . "): " . substr($r['description'], 0, 60) . "...\n";
    }

    echo "\n=== 3. STUDENT ENROLLMENTS (course_rel_user) ===\n";
    $stmt = $pdo->query("
        SELECT cru.c_id, c.title as course_title, u.email, cru.status 
        FROM course_rel_user cru 
        JOIN course c ON c.id = cru.c_id 
        JOIN user u ON u.id = cru.user_id
    ");
    $enrollments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (empty($enrollments)) {
        echo "No student enrollments found yet.\n";
    } else {
        foreach ($enrollments as $enr) {
            echo "Student: " . $enr['email'] . " -> Course #" . $enr['c_id'] . " ('" . $enr['course_title'] . "') [Status: " . $enr['status'] . "]\n";
        }
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
