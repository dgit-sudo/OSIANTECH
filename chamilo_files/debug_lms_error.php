<?php
$logFile = '/var/www/html/chamilo/var/log/prod.log';
if (file_exists($logFile)) {
    $lines = file($logFile);
    $lastLines = array_slice($lines, -150);
    echo "=== LAST 150 LINES OF CHAMILO PROD.LOG ===\n";
    foreach ($lastLines as $line) {
        $json = json_decode($line, true);
        if ($json && isset($json['message'])) {
            echo "[" . ($json['datetime'] ?? '') . "] " . $json['message'] . "\n";
            if (isset($json['context']['exception']['trace'])) {
                echo "Stack Trace:\n";
                foreach (array_slice($json['context']['exception']['trace'], 0, 8) as $t) {
                    echo "  -> " . ($t['file'] ?? '') . ":" . ($t['line'] ?? '') . " " . ($t['class'] ?? '') . ($t['type'] ?? '') . ($t['function'] ?? '') . "()\n";
                }
            }
        } else {
            echo $line;
        }
    }
} else {
    echo "No prod.log found at $logFile\n";
}
