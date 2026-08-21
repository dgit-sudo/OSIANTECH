<?php
$f = '/var/www/html/chamilo/public/main/inc/lib/learnpathItem.class.php';
if (file_exists($f)) {
    echo "=== learnpathItem.class.php ===\n";
    $lines = file($f);
    foreach ($lines as $num => $l) {
        if (strpos($l, 'function get_file_path') !== false || strpos($l, 'function get_url') !== false || strpos($l, 'function get_type') !== false) {
            echo implode('', array_slice($lines, max(0, $num - 5), 45));
            echo "\n-------------------\n";
        }
    }
}
