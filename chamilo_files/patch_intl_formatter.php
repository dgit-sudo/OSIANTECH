<?php
$file = "/var/www/html/chamilo/public/main/inc/lib/internationalization.lib.php";

if (!file_exists($file)) {
    echo "File not found: " . $file . "\n";
    exit;
}

$lines = file($file);
$newLines = [];
$patched = false;

foreach ($lines as $line) {
    if (strpos($line, "$date_formatter = new IntlDateFormatter") !== false) {
        $newLines[] = "        try {\n";
        $newLines[] = "            \$loc = (!empty(\$language) && strlen(\$language) <= 5) ? \$language : 'en_US';\n";
        $newLines[] = "            \$tz = date_default_timezone_get() ?: 'UTC';\n";
        $newLines[] = "            \$date_formatter = new IntlDateFormatter(\$loc, \$datetype, \$timetype, \$tz);\n";
        $newLines[] = "            \$formatted_date = api_to_system_encoding(\$date_formatter ? \$date_formatter->format(\$time) : date('Y-m-d', \$time), 'UTF-8');\n";
        $newLines[] = "        } catch (\\Throwable \$e) {\n";
        $newLines[] = "            \$formatted_date = date('Y-m-d H:i:s', is_numeric(\$time) ? (int)\$time : time());\n";
        $newLines[] = "        }\n";
        $patched = true;
    } elseif (strpos($line, "$formatted_date = api_to_system_encoding($date_formatter->format($time)") !== false) {
        // Skip original line since it is handled in try/catch
        continue;
    } else {
        $newLines[] = $line;
    }
}

file_put_contents($file, implode("", $newLines));

if ($patched) {
    echo "✅ Successfully patched IntlDateFormatter in internationalization.lib.php!\n";
} else {
    echo "⚠️ Target line not found or already patched.\n";
}
