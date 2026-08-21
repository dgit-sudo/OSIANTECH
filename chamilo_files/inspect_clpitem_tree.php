<?php
$lines = file('/var/www/html/chamilo/src/CourseBundle/Entity/CLpItem.php');
echo implode('', array_slice($lines, 90, 70));
