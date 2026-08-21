<?php
$lines = file('/var/www/html/chamilo/public/main/inc/lib/document.lib.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'function get_document_data_by_id') !== false) {
        for ($j = $i; $j <= min(count($lines)-1, $i + 40); $j++) {
            echo ($j+1) . ": " . $lines[$j];
        }
    }
}
