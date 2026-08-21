<?php
$file = '/var/www/html/chamilo/public/main/inc/lib/internationalization.lib.php';

if (!file_exists($file)) {
    echo "File not found: $file\n";
    exit;
}

$content = file_get_contents($file);

// Check around line 540-560
echo "=== TARGET FUNCTION IN internationalization.lib.php ===\n";
$lines = file($file);
foreach ($lines as $num => $line) {
    if ($num >= 530 && $num <= 565) {
        echo ($num + 1) . ": " . $line;
    }
}

// Robust fallback patch for IntlDateFormatter
$oldPattern = <<<'CODE'
        $date_formatter = new IntlDateFormatter($language, $datetype, $timetype, date_default_timezone_get());
        $formatted_date = api_to_system_encoding($date_formatter->format($time), 'UTF-8');
CODE;

$newPattern = <<<'CODE'
        try {
            $loc = (!empty($language) && strlen($language) <= 5) ? $language : 'en_US';
            $tz = date_default_timezone_get() ?: 'UTC';
            $date_formatter = new IntlDateFormatter($loc, $datetype, $timetype, $tz);
            $formatted_date = api_to_system_encoding($date_formatter->format($time), 'UTF-8');
        } catch (Throwable $e) {
            $formatted_date = date('Y-m-d H:i:s', is_numeric($time) ? (int)$time : time());
        }
CODE;

if (strpos($content, '$date_formatter = new IntlDateFormatter') !== false) {
    $content = preg_replace(
        '/$date_formatters*=s*news+IntlDateFormatter([^)]+);s*$formatted_dates*=s*api_to_system_encoding($date_formatter->format($time),s*['"]UTF-8['"]);/s',
        $newPattern,
        $content
    );
    file_put_contents($file, $content);
    echo "\n✅ Successfully patched IntlDateFormatter in $file!\n";
} else {
    echo "\nPattern not found directly, check code above.\n";
}
