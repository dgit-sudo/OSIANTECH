<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$ch = curl_init('http://localhost/api/c_tools?cid=6');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
curl_close($ch);

$data = json_decode($res, true);
echo "=== /api/c_tools?cid=6 RESPONSE ===\n";
if (is_array($data)) {
    echo "Found " . (isset($data['hydra:member']) ? count($data['hydra:member']) : count($data)) . " tools in API:\n";
    $members = $data['hydra:member'] ?? $data;
    foreach ($members as $tool) {
        $title = $tool['title'] ?? $tool['name'] ?? 'unknown';
        $vis = $tool['visibility'] ?? 'N/A';
        echo "  - Tool: $title (visibility: $vis)\n";
    }
} else {
    echo "Raw response: " . substr($res, 0, 300) . "\n";
}
