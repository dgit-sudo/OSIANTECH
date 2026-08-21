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

$em = \Database::getManager();
$lpRepo = Container::getLpRepository();

echo "=== DEFINITIVE VERIFICATION SUMMARY ===\n";

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

$sampleIds = [6, 25, 50, 100, 150, 200, 248];

foreach ($sampleIds as $cid) {
    $course = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find($cid);
    if (!$course) continue;
    
    $lps = $lpRepo->findAllByCourse($course)->getQuery()->getResult();
    echo "\n[Course #$cid: {$course->getTitle()}]\n";
    echo "  findAllByCourse LP Count: " . count($lps) . " (Expected: EXACTLY 1)\n";
    
    foreach ($lps as $lp) {
        $courseInfo = api_get_course_info_by_id($cid);
        $oLP = new learnpath($lp, $courseInfo, 1);
        $toc = $oLP->get_toc();
        echo "  LP #{$lp->getIid()}: '{$lp->getTitle()}' | TOC Modules Count: " . count($toc) . " (Expected: 5)\n";
        foreach ($toc as $m) {
            echo "    • {$m['title']} (docId: {$m['path']})\n";
        }
    }
}
