<?php
echo "=== ToolRepository.php ===\n";
$lines = file('/var/www/html/chamilo/src/CoreBundle/Repository/ToolRepository.php');
echo implode('', array_slice($lines, 0, 70));

echo "\n=== CourseController.php (homeAction or tools) ===\n";
$lines = file('/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'homeAction') !== false || strpos($l, 'getTools') !== false) {
        echo implode('', array_slice($lines, max(0, $i - 5), 45));
        break;
    }
}
