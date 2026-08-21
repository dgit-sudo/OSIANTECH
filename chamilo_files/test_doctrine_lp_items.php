<?php
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';

use Doctrine\Common\Collections\Criteria;
use Chamilo\CoreBundle\Framework\Container;

$lpRepo = Container::getLpRepository();
$lp = $lpRepo->find(249);

echo "LP: " . ($lp ? $lp->getTitle() : "NULL") . "\n";
echo "Raw items count: " . $lp->getItems()->count() . "\n";
foreach ($lp->getItems() as $it) {
    echo "  - Item: #" . $it->getIid() . " | " . $it->getTitle() . " | path: " . $it->getPath() . " | parent: " . ($it->getParent() ? $it->getParent()->getIid() : "NULL") . "\n";
}

$criteria = new Criteria();
$criteria
    ->where($criteria->expr()->neq('path', 'root'))
    ->orderBy(
        [
            'parent' => Criteria::ASC,
            'displayOrder' => Criteria::ASC,
        ]
    );
$matching = $lp->getItems()->matching($criteria);
echo "Matching items count: " . $matching->count() . "\n";
