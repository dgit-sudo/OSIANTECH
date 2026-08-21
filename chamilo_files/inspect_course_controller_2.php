<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$file = '/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php';
if (file_exists($file)) {
    $lines = file($file);
    echo "=== CourseController.php (lines 320-450) ===\n";
    echo implode('', array_slice($lines, 320, 130));
} else {
    echo "File not found.\n";
}
