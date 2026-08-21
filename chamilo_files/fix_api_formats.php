<?php
$yamlFile = '/var/www/html/chamilo/config/packages/api_platform.yaml';

if (file_exists($yamlFile)) {
    $content = file_get_contents($yamlFile);
    if (strpos($content, 'zip:') === false) {
        $content = str_replace(
            "html: ['text/html']",
            "html: ['text/html']
        zip: ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/octet-stream']",
            $content
        );
        file_put_contents($yamlFile, $content);
        echo "✅ Added zip format to api_platform.yaml!
";
    } else {
        echo "zip format already present in api_platform.yaml.
";
    }
}

echo "
=== INSPECTING DocumentCollectionStateProvider.php ===
";
$provider = '/var/www/html/chamilo/src/CoreBundle/State/DocumentCollectionStateProvider.php';
if (file_exists($provider)) {
    $lines = file($provider);
    echo implode('', array_slice($lines, 0, 70));
}
