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

    // Fetch all resource_node records for courses (resource_type_id = 31)
    $stmt = $pdo->query("SELECT id, title FROM resource_node WHERE resource_type_id = 31");
    $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Updating " . count($nodes) . " course resource nodes to valid UUIDv4...\n";

    $updateStmt = $pdo->prepare("UPDATE resource_node SET uuid = ? WHERE id = ?");

    foreach ($nodes as $node) {
        $v4 = Uuid::v4();
        $binaryUuid = $v4->toBinary();
        $updateStmt->execute([$binaryUuid, $node['id']]);
        echo "✅ ResourceNode #" . $node['id'] . " ('" . $node['title'] . "') updated to UUIDv4: " . $v4->toRfc4122() . "\n";
    }

    echo "\nAll course ResourceNodes now have valid UUIDv4!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
