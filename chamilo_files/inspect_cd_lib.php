<?php
$f = '/var/www/html/chamilo/public/main/inc/lib/course_description.lib.php';
if (file_exists($f)) {
    echo "=== course_description.lib.php ===\n";
    $lines = file($f);
    foreach ($lines as $num => $l) {
        if (strpos($l, 'function get_description_data') !== false || strpos($l, 'function get_data') !== false) {
            echo implode('', array_slice($lines, max(0, $num - 5), 45));
            echo "\n-------------------\n";
        }
    }
} else {
    echo "course_description.lib.php not found.\n";
}
