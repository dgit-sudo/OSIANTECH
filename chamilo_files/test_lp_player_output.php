<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$ch = curl_init('http://localhost/main/lp/lp_controller.php?action=view&lp_id=1&cidReq=ORCLADMIN1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$html = curl_exec($ch);
curl_close($ch);

echo "Response size: " . strlen($html) . " bytes\n";
echo "Contains 'Module 1': " . (strpos($html, 'Module 1') !== false ? "YES" : "NO") . "\n";
echo "Contains 'toc': " . (strpos($html, 'toc') !== false ? "YES" : "NO") . "\n";

$lines = explode("\n", $html);
foreach ($lines as $l) {
    if (strpos($l, 'Module') !== false || strpos($l, 'learnpath') !== false || strpos($l, 'error') !== false) {
        echo "  " . trim($l) . "\n";
    }
}
