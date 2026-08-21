<?php
$lines = file('/var/www/html/chamilo/src/CourseBundle/Repository/CLpRepository.php');
echo implode('', array_slice($lines, 70, 70));
