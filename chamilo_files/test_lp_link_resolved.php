<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Chamilo\CoreBundle\Framework\Container;

$courseInfo = api_get_course_info_by_id(6);
$lpRepo = Container::getLpRepository();
$lpEntity = $lpRepo->find(498);

$oLP = new learnpath($lpEntity, $courseInfo, 1);
echo "TOC count: " . count($oLP->get_toc()) . "\n";

$link = $oLP->get_link('http', 1248);
echo "get_link for 1248: $link\n";
