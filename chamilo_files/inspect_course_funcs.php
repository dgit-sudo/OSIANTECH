<?php
$lines = file('/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'function') !== false) {
        echo ($i+1) . ": " . trim($l) . "\n";
    }
}
