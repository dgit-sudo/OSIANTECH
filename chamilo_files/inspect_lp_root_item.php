<?php
echo "=== getRootItem in CLpItemRepository ===\n";
$lines = file('/var/www/html/chamilo/src/CourseBundle/Repository/CLpItemRepository.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'function getRootItem') !== false) {
        for ($j = $i; $j <= min(count($lines)-1, $i + 25); $j++) {
            echo ($j+1) . ": " . $lines[$j];
        }
    }
}
