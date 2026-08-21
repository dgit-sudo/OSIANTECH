<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$ch = curl_init('http://localhost/main/lp/lp_controller.php?action=view&lp_id=1&cidReq=ORCLADMIN1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$html = curl_exec($ch);
curl_close($ch);

echo substr($html, 0, 1500) . "\n";
