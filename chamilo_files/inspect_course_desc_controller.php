<?php
$f = '/var/www/html/chamilo/public/main/course_description/course_description_controller.php';
if (file_exists($f)) {
    echo "=== course_description_controller.php ===\n";
    $lines = file($f);
    echo implode('', array_slice($lines, 0, 80));
}

$f2 = '/var/www/html/chamilo/src/CourseBundle/Repository/CCourseDescriptionRepository.php';
if (file_exists($f2)) {
    echo "\n=== CCourseDescriptionRepository.php ===\n";
    echo file_get_contents($f2);
}

$f3 = '/var/www/html/chamilo/src/CourseBundle/Repository/CLpRepository.php';
if (file_exists($f3)) {
    echo "\n=== CLpRepository.php ===\n";
    echo file_get_contents($f3);
}
