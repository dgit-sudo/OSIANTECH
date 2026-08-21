<?php
echo "=== CTool.php ===\n";
$lines = file('/var/www/html/chamilo/src/CourseBundle/Entity/CTool.php');
echo implode('', array_slice($lines, 0, 80));
