<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';

use Chamilo\CoreBundle\Framework\Container;

$em = \Database::getManager();
$course = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find(6);
$lpRepo = Container::getLpRepository();

$lps = $lpRepo->findAllByCourse($course)->getQuery()->getResult();

echo "findAllByCourse count: " . count($lps) . "\n";
foreach ($lps as $lp) {
    echo "  - LP #{$lp->getIid()} | Title: '{$lp->getTitle()}' | Node ID: {$lp->getResourceNode()->getId()} | Items count: {$lp->getItems()->count()}\n";
    foreach ($lp->getItems() as $it) {
        echo "      • Item #{$it->getIid()}: {$it->getTitle()} (path: {$it->getPath()}, parent: " . ($it->getParent() ? $it->getParent()->getIid() : "NULL") . ")\n";
    }
}
