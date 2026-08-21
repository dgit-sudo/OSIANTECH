<?php
echo "=== CLpItem.php relations ===\n";
$lines = file('/var/www/html/chamilo/src/CourseBundle/Entity/CLpItem.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'ManyToOne') !== false || strpos($l, 'OneToMany') !== false || strpos($l, 'lp') !== false) {
        echo ($i+1) . ": " . $l;
    }
}
