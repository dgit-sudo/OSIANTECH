<?php
$lines = file('/var/www/html/chamilo/public/main/inc/global.inc.php');
echo implode('', array_slice($lines, 0, 100));
