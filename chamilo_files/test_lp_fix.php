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

echo "=== FIX COURSE 6 ARCHITECTURE ===\n";

$courseId = 6;
$c = $pdo->query("SELECT id, code, title, resource_node_id FROM course WHERE id = $courseId")->fetch(PDO::FETCH_ASSOC);
$rootNodeId = (int)$c['resource_node_id'];
$courseTitle = $c['title'];
$courseCode = $c['code'];

// 1. Set all c_tool nodes for course 6 to resource_type_id = 11 (course_tools)
$pdo->prepare("UPDATE resource_node SET resource_type_id = 11 WHERE id IN (SELECT resource_node_id FROM c_tool WHERE c_id = ?)")->execute([$courseId]);
echo "Updated all c_tool nodes to resource_type_id = 11 (course_tools).\n";

// 2. Clear old LPs, descriptions, and documents for course 6
$pdo->prepare("DELETE FROM c_lp_item WHERE lp_id IN (SELECT iid FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?))")->execute([$rootNodeId, $rootNodeId]);
$pdo->prepare("DELETE FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?)")->execute([$rootNodeId, $rootNodeId]);
$pdo->prepare("DELETE FROM c_course_description WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = ? OR id = ?)")->execute([$rootNodeId, $rootNodeId]);
$pdo->prepare("DELETE FROM c_document WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id IN (SELECT id FROM resource_node WHERE parent_id = ?) OR parent_id = ?)")->execute([$rootNodeId, $rootNodeId]);

// Delete orphan nodes of type 13, 17, 39 under root node (excluding c_tool nodes)
$pdo->prepare("DELETE FROM resource_file WHERE resource_node_id IN (SELECT id FROM resource_node WHERE (parent_id = ? OR parent_id IN (SELECT id FROM resource_node WHERE parent_id = ?)) AND id NOT IN (SELECT resource_node_id FROM c_tool WHERE c_id = ?))")->execute([$rootNodeId, $rootNodeId, $courseId]);
$pdo->prepare("DELETE FROM resource_link WHERE resource_node_id IN (SELECT id FROM resource_node WHERE (parent_id = ? OR parent_id IN (SELECT id FROM resource_node WHERE parent_id = ?)) AND id NOT IN (SELECT resource_node_id FROM c_tool WHERE c_id = ?))")->execute([$rootNodeId, $rootNodeId, $courseId]);
$pdo->prepare("DELETE FROM resource_node WHERE (parent_id = ? OR parent_id IN (SELECT id FROM resource_node WHERE parent_id = ?)) AND id NOT IN (SELECT resource_node_id FROM c_tool WHERE c_id = ?)")->execute([$rootNodeId, $rootNodeId, $courseId]);

// 3. Create exactly 1 Course Description node (type 13)
$descUuid = Uuid::v4()->toBinary();
$descSlug = 'c' . $courseId . '-overview-' . substr(md5(uniqid()), 0, 6);
$stmtDescNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 13, 'Course Overview', ?, 0, ?, NOW(), NOW())");
$stmtDescNode->execute([$descUuid, $descSlug, $rootNodeId]);
$descNodeId = (int)$pdo->lastInsertId();

$stmtDescLink = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())");
$stmtDescLink->execute([$descNodeId, $courseId]);

$descHtml = "<p>Interactive overview for $courseTitle.</p>";
$pdo->prepare("INSERT INTO c_course_description (resource_node_id, title, content, description_type, progress) VALUES (?, 'Course Overview & Objectives', ?, 1, 0)")->execute([$descNodeId, $descHtml]);

// 4. Create exactly 1 Learning Path node (type 39)
$lpUuid = Uuid::v4()->toBinary();
$lpSlug = 'c' . $courseId . '-lp-' . substr(md5(uniqid()), 0, 6);
$stmtLpNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 39, ?, ?, 0, ?, NOW(), NOW())");
$stmtLpNode->execute([$lpUuid, $courseTitle . ' — Complete Learning Path', $lpSlug, $rootNodeId]);
$lpNodeId = (int)$pdo->lastInsertId();

$stmtLpLink = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())");
$stmtLpLink->execute([$lpNodeId, $courseId]);

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
        ?, 2, ?, 'Mastery certification path', '',
        0, 'embedded', 'UTF-8', 'Chamilo 2.0 Native LMS',
        'local', '', 1, '', 0,
        '', 'OSIAN Tech Academy', 0, 0, 0,
        1, 0, 0, 0,
        NOW(), NOW(), 1, 0,
        0, 0, 0
    )
");
$stmtInsertLp->execute([$lpNodeId, $courseTitle . ' — Complete Learning Path']);
$lpId = (int)$pdo->lastInsertId();

// 5. Create root c_lp_item
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
$rootItemId = (int)$pdo->lastInsertId();

// 6. Create 5 modules under $lpNodeId
$modules = [
    ['num' => 1, 'tag' => 'Fundamentals & Architecture', 'badge' => '#0284c7'],
    ['num' => 2, 'tag' => 'Core Techniques & Workflows', 'badge' => '#8b5cf6'],
    ['num' => 3, 'tag' => 'Hands-on Practice & Exercises', 'badge' => '#10b981'],
    ['num' => 4, 'tag' => 'Advanced Scenarios & Optimization', 'badge' => '#f59e0b'],
    ['num' => 5, 'tag' => 'Mastery & Certification Review', 'badge' => '#ec4899']
];

$prevItemId = null;

foreach ($modules as $idx => $mod) {
    $order = $idx + 1;
    $modTitle = "Module {$mod['num']}: {$mod['tag']}";
    $modHtml = "<h1>$courseTitle — $modTitle</h1><p>Lesson content for module {$mod['num']}</p>";
    
    $hash = md5("c{$courseId}_live_mod_{$order}_{$modTitle}");
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
    
    $slug = 'c' . $courseId . '-mod-' . $order . '-' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $modTitle)) . '-' . substr(md5(uniqid()), 0, 4);
    $binaryUuid = Uuid::v4()->toBinary();
    
    // ResourceNode under $lpNodeId
    $stmtNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 17, ?, ?, 0, ?, NOW(), NOW())");
    $stmtNode->execute([$binaryUuid, $modTitle, $slug, $lpNodeId]);
    $nodeId = (int)$pdo->lastInsertId();
    
    $stmtRf = $pdo->prepare("INSERT INTO resource_file (resource_node_id, title, original_name, mime_type, size, created_at, updated_at, access_url_id) VALUES (?, ?, ?, 'text/html', ?, NOW(), NOW(), NULL)");
    $stmtRf->execute([$nodeId, $filename, $modTitle . '.html', strlen($modHtml)]);
    
    $stmtRl = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, ?, 0, ?, NOW(), NOW())");
    $stmtRl->execute([$nodeId, $order, $courseId]);
    
    $stmtDoc = $pdo->prepare("INSERT INTO c_document (resource_node_id, title, filetype, readonly, template) VALUES (?, ?, 'file', 0, 0)");
    $stmtDoc->execute([$nodeId, $modTitle]);
    $docIid = (int)$pdo->lastInsertId();
    
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
    $newItemId = (int)$pdo->lastInsertId();
    
    if ($prevItemId !== null) {
        $pdo->exec("UPDATE c_lp_item SET next_item_id = $newItemId WHERE iid = $prevItemId");
    }
    
    $prevItemId = $newItemId;
}

echo "=== TEST DOCTRINE / CHAMILO REPO FOR COURSE 6 ===\n";
$em = \Database::getManager();
$em->clear();

$course = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find($courseId);
$lpRepo = Container::getLpRepository();
$lps = $lpRepo->findAllByCourse($course)->getQuery()->getResult();

echo "findAllByCourse count: " . count($lps) . " (EXPECTED: EXACTLY 1)\n";
foreach ($lps as $lp) {
    echo "  - LP #{$lp->getIid()}: '{$lp->getTitle()}'\n";
    $courseInfo = api_get_course_info_by_id($courseId);
    $oLP = new learnpath($lp, $courseInfo, 1);
    $toc = $oLP->get_toc();
    echo "    TOC Count: " . count($toc) . " (EXPECTED: 5)\n";
    foreach ($toc as $item) {
        echo "      • Item #{$item['id']}: {$item['title']} (docId: {$item['path']})\n";
    }
}
