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

    echo "=== 1. DESCRIBE c_course_description ===\n";
    $stmt = $pdo->query("DESCRIBE c_course_description");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 2. DESCRIBE c_lp ===\n";
    $stmtLp = $pdo->query("DESCRIBE c_lp");
    print_r($stmtLp->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 3. ALL ROWS IN c_course_description ===\n";
    $stmtRows = $pdo->query("SELECT * FROM c_course_description LIMIT 5");
    print_r($stmtRows->fetchAll(PDO::FETCH_ASSOC));

    echo "\n=== 4. ALL ROWS IN c_lp ===\n";
    $stmtLpRows = $pdo->query("SELECT * FROM c_lp LIMIT 5");
    print_r($stmtLpRows->fetchAll(PDO::FETCH_ASSOC));

} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
