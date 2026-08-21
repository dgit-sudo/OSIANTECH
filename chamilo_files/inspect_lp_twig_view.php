<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Chamilo\CoreBundle\Framework\Container;

$lpRepo = Container::getLpRepository();
$lpEntity = $lpRepo->find(1);
$courseInfo = api_get_course_info_by_id(6);

$oLP = new learnpath($lpEntity, $courseInfo, 1);

echo "=== 1. getListArrayToc() OUTPUT ===\n";
print_r($oLP->getListArrayToc());

echo "\n=== 2. SEARCH view.html.twig ===\n";
$files = [
    '/var/www/html/chamilo/src/CoreBundle/Resources/views/LearnPath/view.html.twig',
    '/var/www/html/chamilo/src/CoreBundle/Resources/views/LearnPath/toc.html.twig',
    '/var/www/html/chamilo/src/CoreBundle/Resources/views/LearnPath/item.html.twig'
];
foreach ($files as $f) {
    if (file_exists($f)) {
        echo "Found: $f\n";
        $lines = file($f);
        echo "--- $f (first 40 lines) ---\n";
        echo implode('', array_slice($lines, 0, 40)) . "\n";
    }
}
