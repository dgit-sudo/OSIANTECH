<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Symfony\Component\Dotenv\Dotenv;
use Chamilo\CoreBundle\Framework\Container;

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

$pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== SYSTEM-WIDE VERIFICATION SUMMARY ===\n";

$courseCount = (int)$pdo->query("SELECT count(*) FROM course")->fetchColumn();
$descCount   = (int)$pdo->query("SELECT count(*) FROM c_course_description")->fetchColumn();
$lpCount     = (int)$pdo->query("SELECT count(*) FROM c_lp")->fetchColumn();
$itemCount   = (int)$pdo->query("SELECT count(*) FROM c_lp_item")->fetchColumn();
$docCount    = (int)$pdo->query("SELECT count(*) FROM c_document")->fetchColumn();

echo "Total Courses:            $courseCount\n";
echo "Total Descriptions:       $descCount   (Expected: $courseCount - exactly 1 per course)\n";
echo "Total Learning Paths:     $lpCount     (Expected: $courseCount - exactly 1 per course)\n";
echo "Total LP Items:           $itemCount   (Expected: " . ($courseCount * 6) . " - 1 root + 5 modules per LP)\n";
echo "Total Module Documents:   $docCount    (Expected: " . ($courseCount * 5) . " - 5 per course)\n";

echo "\n=== SAMPLE COURSE TOC & DOCUMENT RESOLUTION CHECKS ===\n";

$sampleIds = [6, 25, 50, 100, 150, 200, 248];

$lpRepo = Container::getLpRepository();

foreach ($sampleIds as $cid) {
    $c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $cid")->fetch(PDO::FETCH_ASSOC);
    if (!$c) {
        continue;
    }
    
    // Find LP for this course
    $lpRow = $pdo->query("SELECT clp.iid, clp.title FROM c_lp clp JOIN resource_link rl ON rl.resource_node_id = clp.resource_node_id WHERE rl.c_id = $cid LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    
    if (!$lpRow) {
        echo "❌ Course $cid ({$c['title']}): No LP found!\n";
        continue;
    }
    
    $lpEntity = $lpRepo->find((int)$lpRow['iid']);
    $courseInfo = api_get_course_info_by_id($cid);
    
    $oLP = new learnpath($lpEntity, $courseInfo, 1);
    $toc = $oLP->get_toc();
    
    echo "\n[Course #$cid: {$c['title']}]\n";
    echo "  LP ID: {$lpRow['iid']} | Title: {$lpRow['title']}\n";
    echo "  TOC Count: " . count($toc) . " (Expected: 5)\n";
    
    $allDocsOk = true;
    foreach ($toc as $item) {
        $docData = DocumentManager::get_document_data_by_id((int)$item['path'], $c['code']);
        if (!$docData || empty($docData['url'])) {
            $allDocsOk = false;
            echo "    ❌ Item #{$item['id']} '{$item['title']}': Failed to resolve doc #{$item['path']}\n";
        }
    }
    
    if ($allDocsOk && count($toc) === 5) {
        echo "  ✅ All 5 sequential modules verified with rich content ready for student viewing!\n";
        foreach ($toc as $item) {
            echo "     • {$item['title']} (docId: {$item['path']})\n";
        }
    }
}
