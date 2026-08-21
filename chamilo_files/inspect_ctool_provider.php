<?php
echo "=== CToolStateProvider.php ===\n";
$lines = file('/var/www/html/chamilo/src/CoreBundle/State/CToolStateProvider.php');
echo implode('', array_slice($lines, 0, 100));
