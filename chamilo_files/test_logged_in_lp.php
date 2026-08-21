<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Chamilo\CoreBundle\Framework\Container;

$course = \Database::getManager()->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find(6);
$lpRepo = Container::getLpRepository();

$lps = $lpRepo->findAllByCourse($course)->getQuery()->getResult();
echo "Total LPs for course 6: " . count($lps) . "\n";

foreach ($lps as $lp) {
    echo "\n=== LP ID: {$lp->getIid()} - '{$lp->getTitle()}' ===\n";
    $courseInfo = api_get_course_info_by_id(6);
    $oLP = new learnpath($lp, $courseInfo, 1);
    $toc = $oLP->get_toc();
    echo "  TOC Count: " . count($toc) . "\n";
    foreach ($toc as $item) {
        echo "    • Item: id={$item['id']}, title={$item['title']}, path={$item['path']}, type={$item['type']}\n";
    }
}
