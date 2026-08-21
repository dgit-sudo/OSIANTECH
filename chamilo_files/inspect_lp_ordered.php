<?php
$lines = file('/var/www/html/chamilo/public/main/lp/learnpath.class.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'ordered_items') !== false || strpos($l, 'function get_toc') !== false || strpos($l, 'function set_ordered_items') !== false) {
        echo "Line " . ($i+1) . ": " . trim($l) . "\n";
        for ($j = max(0, $i - 3); $j <= min(count($lines)-1, $i + 15); $j++) {
            echo "   " . ($j+1) . ": " . $lines[$j];
        }
        echo "----------------------------------------\n";
    }
}
