<?php
$lines = file('/var/www/html/chamilo/public/main/lp/learnpath.class.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'SELECT') !== false && (strpos($l, 'c_lp_item') !== false || strpos($l, 'lp_item') !== false)) {
        echo "Line " . ($i+1) . ": " . trim($l) . "\n";
        for ($j = max(0, $i - 5); $j <= min(count($lines)-1, $i + 15); $j++) {
            echo "   " . ($j+1) . ": " . $lines[$j];
        }
        echo "----------------------------------------\n";
    }
}
