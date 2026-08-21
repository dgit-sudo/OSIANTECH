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

echo "=== 1. ALL c_lp_item ROWS FOR LP 1 (COURSE 6) ===\n";
$items = $pdo->query("SELECT iid, lp_id, item_type, ref, title, path, parent_item_id, previous_item_id, next_item_id, display_order FROM c_lp_item WHERE lp_id = 1 ORDER BY display_order ASC, iid ASC")->fetchAll(PDO::FETCH_ASSOC);
print_r($items);

echo "\n=== 2. HOW learnpath::get_first_item() and learnpath::get_toc() WORK ===\n";
$lpRepo = Container::getLpRepository();
$lpEntity = $lpRepo->find(1);
$courseInfo = api_get_course_info_by_id(6);

$oLP = new learnpath($lpEntity, $courseInfo, 1);
echo "Current item ID: " . $oLP->get_current_item_id() . "\n";
echo "First item ID: " . $oLP->get_first_item_id() . "\n";
echo "TOC list:\n";
print_r($oLP->get_toc());

echo "\n=== 3. SEARCH SOURCE IN learnpath.class.php FOR FIRST ITEM / CURRENT ITEM ===\n";
$lines = file('/var/www/html/chamilo/public/main/lp/learnpath.class.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'function get_first_item') !== false || strpos($l, 'function get_toc') !== false || strpos($l, 'function set_current_item') !== false) {
        echo ($i+1) . ": " . trim($l) . "\n";
    }
}
