<?php
$lines = file('/var/www/html/chamilo/public/main/lp/lp_view.php');
echo implode('', array_slice($lines, 200, 150));
