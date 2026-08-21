<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$dbUrl = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL') ?? '';
$parts = parse_url($dbUrl);
$host = $parts['host'] ?? '127.0.0.1';
$port = $parts['port'] ?? 3306;
$user = $parts['user'] ?? 'root';
$pass = $parts['pass'] ?? '';
$db   = ltrim($parts['path'] ?? '', '/');

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    echo "=== WRITING PHYSICAL HTML FILES FOR ALL 248 COURSES ===\n";

    $stmt = $pdo->query("
        SELECT cd.iid, cd.resource_node_id, cd.title, cd.comment, rn.path as node_path, rn.parent_id, c.id as course_id, c.code as course_code
        FROM c_document cd
        JOIN resource_node rn ON rn.id = cd.resource_node_id
        JOIN resource_node rnp ON rnp.id = rn.parent_id
        JOIN course c ON c.resource_node_id = rnp.id
    ");
    $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($docs) . " course documents to write to disk.\n";

    $baseDirs = [
        '/var/www/html/chamilo/var/upload',
        '/var/www/html/chamilo/public/upload',
        '/var/www/html/chamilo/var/courses',
        '/var/www/html/chamilo/app/upload'
    ];

    foreach ($baseDirs as $bd) {
        if (!is_dir($bd)) {
            @mkdir($bd, 0777, true);
        }
    }

    $written = 0;
    foreach ($docs as $d) {
        $nodePath = trim($d['node_path'] ?? '', '/');
        $courseId = $d['course_id'];
        $courseCode = $d['course_code'];
        $html = $d['comment'];

        // Wrap in complete styled HTML
        $styledHtml = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$d['title']}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.6;
            padding: 30px;
            max-width: 900px;
            margin: 0 auto;
        }
        h2 {
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-top: 0;
            font-size: 26px;
        }
        h3 {
            color: #1e40af;
            margin-top: 24px;
            font-size: 18px;
            font-weight: 700;
        }
        p {
            font-size: 15px;
            color: #334155;
        }
        ul {
            padding-left: 24px;
        }
        li {
            margin-bottom: 8px;
            color: #334155;
            font-size: 15px;
        }
        strong {
            color: #0f172a;
        }
        .highlight-box {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 16px 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="highlight-box">
        {$html}
    </div>
</body>
</html>
HTML;

        // Write to multiple standard Chamilo paths to cover all potential asset lookups
        $fileTargets = [
            "/var/www/html/chamilo/var/upload/" . $nodePath,
            "/var/www/html/chamilo/var/upload/course-{$courseId}/intro-{$d['resource_node_id']}.html",
            "/var/www/html/chamilo/var/upload/course-{$courseId}/intro-{$courseId}.html",
            "/var/www/html/chamilo/var/upload/{$courseCode}/document/intro-{$courseId}.html",
            "/var/www/html/chamilo/var/upload/{$courseCode}/document/intro.html"
        ];

        foreach ($fileTargets as $tgt) {
            $dir = dirname($tgt);
            if (!is_dir($dir)) {
                @mkdir($dir, 0777, true);
            }
            file_put_contents($tgt, $styledHtml);
            @chmod($tgt, 0777);
        }

        $written++;
    }

    echo "✅ Successfully written and styled physical HTML files for $written courses!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
