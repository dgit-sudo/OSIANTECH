<?php
$lines = file('/var/www/html/chamilo/public/main/lp/learnpath.class.php');
echo implode('', array_slice($lines, 200, 100));
