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

    echo "--- C_TOOL TABLE COLUMNS ---\n";
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM c_tool");
        while ($col = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo $col['Field'] . " (" . $col['Type'] . ") - Null: " . $col['Null'] . "\n";
        }
    } catch (Exception $e) {
        echo "No c_tool table: " . $e->getMessage() . "\n";
    }

    echo "\n--- CHECKING TOOL TABLE COLUMNS ---\n";
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM tool");
        while ($col = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo $col['Field'] . " (" . $col['Type'] . ") - Null: " . $col['Null'] . "\n";
        }
    } catch (Exception $e) {
        echo "No tool table: " . $e->getMessage() . "\n";
    }

    echo "\n--- ALL TOOLS IN 'tool' TABLE ---\n";
    try {
        $stmt = $pdo->query("SELECT id, name, link, image, visibility FROM tool LIMIT 15");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            print_r($row);
        }
    } catch (Exception $e) {
        echo "Error selecting from tool: " . $e->getMessage() . "\n";
    }

    echo "\n--- TOOLS IN 'c_tool' FOR EXISTING COURSES ---\n";
    try {
        $stmt = $pdo->query("SELECT * FROM c_tool LIMIT 10");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            print_r($row);
        }
    } catch (Exception $e) {
        echo "Error selecting from c_tool: " . $e->getMessage() . "\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== READING CourseHelper::createCourse() ===\n";
$helperFile = '/var/www/html/chamilo/src/CoreBundle/Helpers/CourseHelper.php';
if (file_exists($helperFile)) {
    $lines = file($helperFile);
    echo implode('', array_slice($lines, 100, 70));
}
