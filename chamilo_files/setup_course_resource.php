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

    // Find all courses lacking resource_node_id
    $stmt = $pdo->query("SELECT id, code, title FROM course WHERE resource_node_id IS NULL OR resource_node_id = 0");
    $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($courses) . " courses needing ResourceNode setup.\n";

    foreach ($courses as $c) {
        $cId = (int) $c['id'];
        $title = $c['title'] ?: 'Course ' . $c['code'];
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title), '-')) ?: ('course-' . $cId);

        // Insert into resource_node
        $stmtNode = $pdo->prepare("
            INSERT INTO resource_node (
                resource_type_id, creator_id, title, slug, level,
                created_at, updated_at, public, uuid
            ) VALUES (
                31, 1, ?, ?, 1,
                NOW(), NOW(), 1, UNHEX(REPLACE(UUID(), '-', ''))
            )
        ");
        $stmtNode->execute([$title, $slug]);
        $nodeId = (int) $pdo->lastInsertId();

        $path = $slug . '-' . $nodeId . '/';
        $pdo->prepare("UPDATE resource_node SET path = ? WHERE id = ?")->execute([$path, $nodeId]);

        // Link course to resource_node
        $pdo->prepare("UPDATE course SET resource_node_id = ? WHERE id = ?")->execute([$nodeId, $cId]);

        echo "✅ Course #$cId ('$title') linked to ResourceNode #$nodeId (path: $path)\n";
    }

    echo "\nAll courses now have valid ResourceNodes!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
