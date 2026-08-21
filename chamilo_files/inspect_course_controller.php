<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$file = '/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php';
if (file_exists($file)) {
    $lines = file($file);
    echo "=== CourseController.php (lines 170-320) ===\n";
    echo implode('', array_slice($lines, 170, 150));
} else {
    echo "File not found.\n";
}
