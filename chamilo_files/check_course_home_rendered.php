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

    echo "=== TOTAL COURSES IN DB ===\n";
    $stmt = $pdo->query("SELECT count(*) as cnt FROM course");
    echo "Count: " . $stmt->fetch(PDO::FETCH_ASSOC)['cnt'] . "\n\n";

    echo "=== FIRST 5 COURSES ===\n";
    $stmt = $pdo->query("SELECT id, code, title, visibility, subscribe, resource_node_id FROM course LIMIT 5");
    $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($courses);

    if (!empty($courses)) {
        $firstCourse = $courses[0];
        $cId = (int) $firstCourse['id'];
        $nodeId = (int) $firstCourse['resource_node_id'];

        echo "\n=== TOOLS FOR COURSE #$cId ('" . $firstCourse['title'] . "') ===\n";
        $stmt = $pdo->prepare("SELECT iid, tool_id, title, resource_node_id FROM c_tool WHERE c_id = ?");
        $stmt->execute([$cId]);
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

        echo "\n=== SHORTCUTS FOR COURSE #$cId ===\n";
        $stmt = $pdo->prepare("SELECT * FROM c_shortcut WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?)");
        $stmt->execute([$nodeId, $nodeId]);
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

        echo "\n=== LEARNING PATHS (c_lp) FOR COURSE #$cId ===\n";
        $stmt = $pdo->prepare("SELECT * FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?)");
        $stmt->execute([$nodeId, $nodeId]);
        $lps = $stmt->fetchAll(PDO::FETCH_ASSOC);
        print_r($lps);

        if (!empty($lps)) {
            $lpId = (int) $lps[0]['iid'];
            echo "\n=== LEARNING PATH ITEMS (c_lp_item) FOR LP #$lpId ===\n";
            $stmt = $pdo->prepare("SELECT * FROM c_lp_item WHERE lp_id = ?");
            $stmt->execute([$lpId]);
            print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
        }

        echo "\n=== DOCUMENTS (c_document) FOR COURSE #$cId ===\n";
        $stmt = $pdo->prepare("SELECT * FROM c_document WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?)");
        $stmt->execute([$nodeId, $nodeId]);
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
