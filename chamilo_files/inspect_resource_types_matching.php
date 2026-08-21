<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
if (file_exists('/var/www/html/chamilo/src/Kernel.php')) {
    require_once '/var/www/html/chamilo/src/Kernel.php';
}

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$kernelClass = class_exists('\App\Kernel') ? '\App\Kernel' : (class_exists('\Chamilo\Kernel') ? '\Chamilo\Kernel' : null);
$kernel = new $kernelClass('prod', false);
$kernel->boot();
$container = $kernel->getContainer();

$em = $container->get('doctrine.orm.entity_manager');

echo "=== 1. ALL RESOURCE TYPES IN DB ===\n";
$rts = $em->getRepository(\Chamilo\CoreBundle\Entity\ResourceType::class)->findAll();
foreach ($rts as $rt) {
    echo "ID " . $rt->getId() . ": '" . $rt->getTitle() . "' (Tool: " . ($rt->getTool() ? $rt->getTool()->getTitle() : 'none') . ")\n";
}

echo "\n=== 2. TYPE EXPECTED BY REPOSITORIES ===\n";
$cdRepo = $container->get(\Chamilo\CourseBundle\Repository\CCourseDescriptionRepository::class);
echo "CCourseDescriptionRepository::getResourceTypeName() = '" . $cdRepo->getResourceTypeName() . "'\n";

$lpRepo = $container->get(\Chamilo\CourseBundle\Repository\CLpRepository::class);
echo "CLpRepository::getResourceTypeName() = '" . $lpRepo->getResourceTypeName() . "'\n";

$docRepo = $container->get(\Chamilo\CourseBundle\Repository\CDocumentRepository::class);
echo "CDocumentRepository::getResourceTypeName() = '" . $docRepo->getResourceTypeName() . "'\n";

echo "\n=== 3. CHECK COURSE 6 RESOURCE NODES AND THEIR RESOURCE TYPES ===\n";
$course = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find(6);
$links = $course->getResourceNode()->getResourceLinks();
$courseLinks = $em->getRepository(\Chamilo\CoreBundle\Entity\ResourceLink::class)->findBy(['course' => $course]);
echo "Total ResourceLinks for Course 6: " . count($courseLinks) . "\n";
foreach ($courseLinks as $l) {
    $rn = $l->getResourceNode();
    $rt = $rn ? $rn->getResourceType() : null;
    echo " - Link #" . $l->getId() . " -> Node #" . ($rn ? $rn->getId() : 'none') . " ('" . ($rn ? $rn->getTitle() : '') . "') -> Type: '" . ($rt ? $rt->getTitle() : 'NULL') . "' (Type ID: " . ($rt ? $rt->getId() : 'NULL') . "), Visibility: " . $l->getVisibility() . "\n";
}
