<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;
use Doctrine\Common\Collections\Criteria;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$kernel = new \App\Kernel('prod', false);
$kernel->boot();
$container = $kernel->getContainer();
$em = $container->get('doctrine.orm.entity_manager');

$lpRepo = $em->getRepository(\Chamilo\CourseBundle\Entity\CLp::class);
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
