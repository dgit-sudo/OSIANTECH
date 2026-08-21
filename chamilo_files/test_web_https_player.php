<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$ch = curl_init('http://127.0.0.1/main/lp/lp_controller.php?action=view&lp_id=1&cidReq=ORCLADMIN1');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Host: learn.osian.tech',
    'X-Forwarded-Proto: https',
    'X-Forwarded-Port: 443',
    'X-Forwarded-For: 127.0.0.1'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
curl_close($ch);

echo "Response length: " . strlen($res) . "\n";
$matches = [];
preg_match_all('/http:\/\/learn\.osian\.tech[^"\'\s>]+/i', $res, $matches);
echo "Insecure http:// matches: " . count($matches[0]) . "\n";
foreach (array_slice($matches[0], 0, 5) as $m) {
    echo "  - Insecure URL: $m\n";
}

$secMatches = [];
preg_match_all('/https:\/\/learn\.osian\.tech[^"\'\s>]+/i', $res, $secMatches);
echo "Secure https:// matches: " . count($secMatches[0]) . "\n";
foreach (array_slice($secMatches[0], 0, 5) as $m) {
    echo "  - Secure URL: $m\n";
}
