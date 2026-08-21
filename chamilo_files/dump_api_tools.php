<?php
$ch = curl_init('http://localhost/api/c_tools?cid=6');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
curl_close($ch);

echo "=== RAW RESPONSE ===\n";
echo $res . "\n";
