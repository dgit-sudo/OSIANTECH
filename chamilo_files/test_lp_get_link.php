<?php
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

$course = api_get_course_entity(6);
$lpRepo = \Chamilo\CoreBundle\Framework\Container::getLpRepository();
$lp = $lpRepo->find(249);

echo "LP found: " . ($lp ? $lp->getTitle() : "NULL") . "\n";

$oLP = new learnpath($lp, $course, null);
echo "TOC:\n";
print_r($oLP->get_toc());

echo "\nLink for item 1:\n";
$link = $oLP->get_link('http', 1);
echo "get_link: $link\n";
