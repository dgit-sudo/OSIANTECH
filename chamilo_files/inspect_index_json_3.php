<?php
$lines = file('/var/www/html/chamilo/src/CoreBundle/Controller/CourseController.php');
echo implode('', array_slice($lines, 330, 90));
