<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
if (file_exists('/var/www/html/chamilo/src/Kernel.php')) {
    require_once '/var/www/html/chamilo/src/Kernel.php';
}

$kernelClass = class_exists('\App\Kernel') ? '\App\Kernel' : (class_exists('\Chamilo\Kernel') ? '\Chamilo\Kernel' : null);
$kernel = new $kernelClass('prod', false);
$kernel->boot();
$container = $kernel->getContainer();

$em = $container->get('doctrine.orm.entity_manager');
$courseRepo = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class);
$course = $courseRepo->find(6);

echo "Course 6: " . ($course ? $course->getTitle() . " (Node #" . $course->getResourceNode()->getId() . ")" : "NOT FOUND") . "\n\n";

if ($course) {
    echo "=== 1. TESTING CCourseDescriptionRepository::findAllInCourse ===\n";
    $cdRepo = $container->get(\Chamilo\CourseBundle\Repository\CCourseDescriptionRepository::class);
    $qbCd = $cdRepo->getResourcesByCourse($course);
    echo "DQL: " . $qbCd->getDQL() . "\n";
    echo "SQL: " . $qbCd->getQuery()->getSQL() . "\n";
    $cdResults = $qbCd->getQuery()->getResult();
    echo "Found " . count($cdResults) . " Course Descriptions\n";
    foreach ($cdResults as $cd) {
        echo " - #" . $cd->getIid() . ": " . $cd->getTitle() . " (Node #" . ($cd->getResourceNode() ? $cd->getResourceNode()->getId() : 'none') . ")\n";
    }

    echo "\n=== 2. TESTING CLpRepository::findAllByCourse ===\n";
    $lpRepo = $container->get(\Chamilo\CourseBundle\Repository\CLpRepository::class);
    $qbLp = $lpRepo->findAllByCourse($course);
    echo "DQL: " . $qbLp->getDQL() . "\n";
    echo "SQL: " . $qbLp->getQuery()->getSQL() . "\n";
    $lpResults = $qbLp->getQuery()->getResult();
    echo "Found " . count($lpResults) . " Learning Paths\n";
    foreach ($lpResults as $lp) {
        echo " - #" . $lp->getIid() . ": " . $lp->getTitle() . " (Node #" . ($lp->getResourceNode() ? $lp->getResourceNode()->getId() : 'none') . ", Items: " . $lp->getItems()->count() . ")\n";
    }

    echo "\n=== 3. TESTING CDocumentRepository::getResourcesByCourse ===\n";
    $docRepo = $container->get(\Chamilo\CourseBundle\Repository\CDocumentRepository::class);
    $qbDoc = $docRepo->getResourcesByCourse($course);
    $docResults = $qbDoc->getQuery()->getResult();
    echo "Found " . count($docResults) . " Documents\n";
    foreach ($docResults as $doc) {
        echo " - #" . $doc->getIid() . ": " . $doc->getTitle() . " (Node #" . ($doc->getResourceNode() ? $doc->getResourceNode()->getId() : 'none') . ")\n";
    }
}
