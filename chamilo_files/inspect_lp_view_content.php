<?php
echo "=== lp_content.php ===\n";
echo file_get_contents('/var/www/html/chamilo/public/main/lp/lp_content.php');

echo "\n=== lp_view.php (first 100 lines) ===\n";
$lines = file('/var/www/html/chamilo/public/main/lp/lp_view.php');
echo implode('', array_slice($lines, 0, 100));
