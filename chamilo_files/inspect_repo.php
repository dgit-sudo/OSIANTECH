<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$file = '/var/www/html/chamilo/src/CoreBundle/Repository/Node/CourseRepository.php';
if (file_exists($file)) {
    $content = file_get_contents($file);
    preg_match_all('/public function ([a-zA-Z0-9_]+)\s*\(([^)]*)\)/', $content, $matches, PREG_SET_ORDER);
    echo "=== CourseRepository Methods ===\n";
    foreach ($matches as $m) {
        echo "function " . $m[1] . "(" . $m[2] . ")\n";
    }
} else {
    echo "CourseRepository.php not found at $file\n";
}
