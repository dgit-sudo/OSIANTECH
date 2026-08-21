<?php
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

$courseInfo = api_get_course_info_by_id(6);
$lpRepo = \Chamilo\CoreBundle\Framework\Container::getLpRepository();
$lp = $lpRepo->find(249);

$oLP = new learnpath($lp, $courseInfo, 1);
echo "LP found: " . ($lp ? $lp->getTitle() : "NULL") . "\n";
echo "TOC count: " . count($oLP->get_toc()) . "\n";
print_r($oLP->get_toc());

echo "\nLink for item 1:\n";
$link = $oLP->get_link('http', 1);
echo "get_link: $link\n";

echo "\nChecking learnpathItem details for item 1:\n";
if (isset($oLP->items[1])) {
    $item = $oLP->items[1];
    echo "Item type: " . $item->get_type() . "\n";
    echo "Item path: " . $item->get_path() . "\n";
    echo "Item file path: " . $item->get_file_path() . "\n";
} else {
    echo "Item 1 not in items array. Items keys: " . implode(', ', array_keys($oLP->items)) . "\n";
}
