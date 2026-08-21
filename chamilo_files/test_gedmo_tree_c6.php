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

echo "=== TEST GEDMO NESTED SET FOR LP 1 (COURSE 6) ===\n";

// Update root item
$pdo->exec("UPDATE c_lp_item SET item_root = 1, parent_item_id = NULL, previous_item_id = 1, next_item_id = 12, lvl = 0, display_order = 0 WHERE iid = 1");

// Update 5 module items
$left = 2;
for ($i = 2; $i <= 6; $i++) {
    $rgt = $left + 1;
    $order = $i - 1;
    $pdo->prepare("UPDATE c_lp_item SET item_root = 1, parent_item_id = 1, previous_item_id = ?, next_item_id = ?, lvl = 1, display_order = ? WHERE iid = ?")->execute([$left, $rgt, $order, $i]);
    $left += 2;
}

echo "c_lp_item updated with Gedmo NestedSet values!\n";

$em = \Database::getManager();
$em->clear();

$lpRepo = Container::getLpRepository();
$lpEntity = $lpRepo->find(1);
$courseInfo = api_get_course_info_by_id(6);

$oLP = new learnpath($lpEntity, $courseInfo, 1);

echo "\n=== getListArrayToc() RESULT ===\n";
$tocList = $oLP->getListArrayToc();
print_r($tocList);

echo "TOC Count: " . count($tocList) . " (EXPECTED: 5)\n";
foreach ($tocList as $item) {
    echo "  - TOC Node: id={$item['iid']}, title={$item['title']}, lvl={$item['lvl']}\n";
}
