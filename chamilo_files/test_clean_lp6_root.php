<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Uid\Uuid;
use Chamilo\CoreBundle\Framework\Container;

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

$pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== TEST CLEAN LP FOR COURSE 6 ===\n";

$courseId = 6;
$c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $courseId")->fetch(PDO::FETCH_ASSOC);
$rootNodeId = (int)$c['resource_node_id'];
$courseTitle = $c['title'];

// Delete all old LPs for course 6
$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

$oldLps = $pdo->query("SELECT iid FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = $rootNodeId)")->fetchAll(PDO::FETCH_COLUMN);
if (!empty($oldLps)) {
    $lpIdsStr = implode(',', $oldLps);
    $pdo->exec("DELETE FROM c_lp_item_view WHERE lp_item_id IN (SELECT iid FROM c_lp_item WHERE lp_id IN ($lpIdsStr))");
    $pdo->exec("DELETE FROM c_lp_item WHERE lp_id IN ($lpIdsStr)");
    $pdo->exec("DELETE FROM c_lp WHERE iid IN ($lpIdsStr)");
}

// Delete old LP resource nodes for course 6
$pdo->exec("DELETE FROM resource_link WHERE c_id = $courseId AND resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = $rootNodeId AND resource_type_id = 39)");
$pdo->exec("DELETE FROM resource_node WHERE parent_id = $rootNodeId AND resource_type_id = 39");

$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

// Create 1 clean LP ResourceNode
$lpUuid = Uuid::v4()->toBinary();
$lpSlug = 'c' . $courseId . '-learnpath';
$stmtLpNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 39, ?, ?, 0, ?, NOW(), NOW())");
$stmtLpNode->execute([$lpUuid, $courseTitle . ' — Complete Learning Path', $lpSlug, $rootNodeId]);
$lpNodeId = $pdo->lastInsertId();

// Create ResourceLink
$stmtLpLink = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())");
$stmtLpLink->execute([$lpNodeId, $courseId]);

// Create c_lp
$stmtInsertLp = $pdo->prepare("
    INSERT INTO c_lp (
        resource_node_id, lp_type, title, description, path,
        force_commit, default_view_mod, default_encoding, content_maker,
        content_local, content_license, prevent_reinit, js_lib, debug,
        theme, author, prerequisite, hide_toc_frame, seriousgame_mode,
        use_max_score, autolaunch, max_attempts, subscribe_users,
        created_on, modified_on, accumulate_scorm_time, accumulate_work_time,
        next_lp_id, subscribe_user_by_date, auto_forward_video
    ) VALUES (
        ?, 2, ?, 'Mastery certification path for $courseTitle', '',
        0, 'embedded', 'UTF-8', 'Chamilo 2.0 Native LMS',
        'local', '', 1, '', 0,
        '', 'OSIAN Tech Academy', 0, 0, 0,
        1, 0, 0, 0,
        NOW(), NOW(), 1, 0,
        0, 0, 0
    )
");
$stmtInsertLp->execute([$lpNodeId, $courseTitle . ' — Complete Learning Path']);
$lpId = $pdo->lastInsertId();
echo "Created c_lp iid: $lpId\n";

// Create root c_lp_item (path = 'root')
$stmtRootItem = $pdo->prepare("
    INSERT INTO c_lp_item (
        lp_id, item_type, ref, title, description, path,
        min_score, max_score, mastery_score, parent_item_id,
        previous_item_id, next_item_id, display_order, prerequisite,
        parameters, launch_data, max_time_allowed, terms, search_did,
        audio, prerequisite_min_score, prerequisite_max_score, lvl,
        duration, export_allowed
    ) VALUES (
        ?, 'root', 0, 'root', '', 'root',
        0, 100, 0, NULL,
        NULL, NULL, 0, '',
        '', '', '', '', 0,
        '', 0, 0, 0,
        0, 0
    )
");
$stmtRootItem->execute([$lpId]);
$rootItemId = $pdo->lastInsertId();
echo "Created root c_lp_item iid: $rootItemId\n";

// Create 5 modules with parent_item_id = $rootItemId
$modules = [
    ['num' => 1, 'tag' => 'Fundamentals & Architecture', 'badge' => '#0284c7'],
    ['num' => 2, 'tag' => 'Core Techniques & Workflows', 'badge' => '#8b5cf6'],
    ['num' => 3, 'tag' => 'Hands-on Practice & Exercises', 'badge' => '#10b981'],
    ['num' => 4, 'tag' => 'Advanced Scenarios & Optimization', 'badge' => '#f59e0b'],
    ['num' => 5, 'tag' => 'Mastery & Certification Review', 'badge' => '#ec4899']
];

$prevItemId = null;
$firstModuleItemId = null;

foreach ($modules as $idx => $mod) {
    $order = $idx + 1;
    $modTitle = "Module {$mod['num']}: {$mod['tag']}";
    
    $modHtml = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$courseTitle — $modTitle</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.75; color: #1e293b; padding: 36px 40px; max-width: 920px; margin: 0 auto; background: #ffffff; }
        .badge { display: inline-block; background: {$mod['badge']}; color: #ffffff; padding: 5px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        h1 { color: #0f172a; font-size: 26px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-top: 0; }
        h2 { color: #1e293b; font-size: 20px; font-weight: 700; margin-top: 32px; border-left: 4px solid {$mod['badge']}; padding-left: 12px; }
        p { font-size: 15px; color: #334155; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px 26px; margin: 24px 0; }
        .card h3 { margin-top: 0; color: #0f172a; font-size: 17px; }
        .card ul { margin: 0; padding-left: 22px; color: #475569; font-size: 14.5px; }
        .card li { margin-bottom: 8px; }
        .code { background: #0f172a; color: #38bdf8; padding: 18px 22px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 13.5px; }
    </style>
</head>
<body>
    <span class="badge">Module {$mod['num']} • OSIAN Certified</span>
    <h1>$courseTitle — {$mod['tag']}</h1>
    <p>Comprehensive interactive training module for $courseTitle.</p>
    <div class="card">
        <h3>📌 Key Learning Outcomes:</h3>
        <ul>
            <li>Understand core concepts and technical specifications for $courseTitle.</li>
            <li>Execute step-by-step practical exercises in the interactive sandbox.</li>
            <li>Master advanced troubleshooting and production workflows.</li>
        </ul>
    </div>
    <h2>Interactive Lab Walkthrough:</h2>
    <div class="code">osian-cli start-lab --course="$courseTitle" --module={$mod['num']}</div>
</body>
</html>
HTML;
    
    $hash = md5("c{$courseId}_clean_mod_{$order}_{$modTitle}");
    $filename = $hash . '.html';
    $c1 = substr($hash, 0, 1);
    $c2 = substr($hash, 1, 1);
    $c3 = substr($hash, 2, 1);
    
    $dir = "/var/www/html/chamilo/var/upload/resource/$c1/$c2/$c3";
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    file_put_contents("$dir/$filename", $modHtml);
    chmod("$dir/$filename", 0666);
    
    $slug = 'c' . $courseId . '-mod-' . $order . '-' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $modTitle));
    $binaryUuid = Uuid::v4()->toBinary();
    
    // Create ResourceNode (resource_type_id = 17)
    $stmtNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 17, ?, ?, 0, ?, NOW(), NOW())");
    $stmtNode->execute([$binaryUuid, $modTitle, $slug, $rootNodeId]);
    $nodeId = $pdo->lastInsertId();
    
    // Create ResourceFile
    $stmtRf = $pdo->prepare("INSERT INTO resource_file (resource_node_id, title, original_name, mime_type, size, created_at, updated_at, access_url_id) VALUES (?, ?, ?, 'text/html', ?, NOW(), NOW(), NULL)");
    $stmtRf->execute([$nodeId, $filename, $modTitle . '.html', strlen($modHtml)]);
    
    // Create ResourceLink (visibility = 0 to keep Documents tool clean)
    $stmtRl = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 0, ?, 0, ?, NOW(), NOW())");
    $stmtRl->execute([$nodeId, $order, $courseId]);
    
    // Create c_document
    $stmtDoc = $pdo->prepare("INSERT INTO c_document (resource_node_id, title, filetype, readonly, template) VALUES (?, ?, 'file', 0, 0)");
    $stmtDoc->execute([$nodeId, $modTitle]);
    $docIid = $pdo->lastInsertId();
    
    // Create c_lp_item with parent_item_id = $rootItemId
    $stmtLpItem = $pdo->prepare("
        INSERT INTO c_lp_item (
            lp_id, item_type, ref, title, description, path,
            min_score, max_score, mastery_score, parent_item_id,
            previous_item_id, next_item_id, display_order, prerequisite,
            parameters, launch_data, max_time_allowed, terms, search_did,
            audio, prerequisite_min_score, prerequisite_max_score, lvl,
            duration, export_allowed
        ) VALUES (
            ?, 'document', ?, ?, '', ?,
            0, 100, 0, ?,
            ?, NULL, ?, '',
            '', '', '', '', 0,
            '', 0, 0, 0,
            0, 0
        )
    ");
    $stmtLpItem->execute([$lpId, $nodeId, $modTitle, (string)$docIid, $rootItemId, $prevItemId, $order]);
    $newItemId = $pdo->lastInsertId();
    
    if ($firstModuleItemId === null) {
        $firstModuleItemId = $newItemId;
    }
    
    if ($prevItemId !== null) {
        $pdo->exec("UPDATE c_lp_item SET next_item_id = $newItemId WHERE iid = $prevItemId");
    }
    
    $prevItemId = $newItemId;
}

echo "Created 5 modules! First module item id: $firstModuleItemId\n";

// Test Doctrine entity reload & learnpath
$em = Database::getManager();
$em->clear();

$courseInfo = api_get_course_info_by_id($courseId);
$lpRepo = Container::getLpRepository();
$lpEntity = $lpRepo->find($lpId);

$oLP = new learnpath($lpEntity, $courseInfo, 1);
echo "\n=== TEST LEARNPATH RESULT ===\n";
echo "TOC count: " . count($oLP->get_toc()) . "\n";
foreach ($oLP->get_toc() as $toc) {
    echo "  - TOC Item: id={$toc['id']}, title={$toc['title']}, type={$toc['type']}, path={$toc['path']}\n";
}
