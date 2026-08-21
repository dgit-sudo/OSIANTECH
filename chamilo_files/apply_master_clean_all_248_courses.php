<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Uid\Uuid;

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

echo "=== CHAMILO 2.0 MASTER CLEAN PROVISIONER (248 COURSES) ===\n";

// Disable FK checks to safely truncate
$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
$pdo->exec("TRUNCATE TABLE c_course_description");
$pdo->exec("TRUNCATE TABLE c_lp_item_view");
$pdo->exec("TRUNCATE TABLE c_lp_item");
$pdo->exec("TRUNCATE TABLE c_document");
$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
echo "✅ Cleared all duplicate descriptions, LP items, and documents.\n";

// Also set visibility = 0 for any old standalone document links across all courses
$pdo->exec("
    UPDATE resource_link rl
    JOIN resource_node rn ON rn.id = rl.resource_node_id
    SET rl.visibility = 0
    WHERE rn.resource_type_id = 17
");
echo "✅ Hidden all standalone files from Documents tools.\n";

// Load catalog mapped by normalized title
$coursesJson = json_decode(file_get_contents('/var/www/html/chamilo/courses_data.json'), true) ?: [];
$catByTitle = [];
foreach ($coursesJson as $catItem) {
    $catByTitle[strtolower(trim($catItem['title'] ?? ''))] = $catItem;
}

// Load all courses from database
$stmtCourses = $pdo->query("SELECT id, code, title, resource_node_id FROM course ORDER BY id ASC");
$dbCourses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

$processed = 0;
$seenCourseIds = [];

foreach ($dbCourses as $courseDb) {
    $courseId = (int)$courseDb['id'];
    if (isset($seenCourseIds[$courseId])) {
        continue;
    }
    $seenCourseIds[$courseId] = true;
    
    $courseTitle = trim($courseDb['title']);
    $rootNodeId = (int)$courseDb['resource_node_id'];
    
    $catItem = $catByTitle[strtolower($courseTitle)] ?? [];
    $cCategory = $catItem['category'] ?? 'Technology & Professional Skills';
    $cDesc = $catItem['description'] ?? 'Master industry-standard skills, practical workflows, and production techniques in this comprehensive certification curriculum.';
    
    // 1. Find or create Course Description node
    $stmtNode = $pdo->prepare("SELECT id FROM resource_node WHERE parent_id = ? AND (title = 'Course Overview' OR title = 'course_description' OR resource_type_id = 13) LIMIT 1");
    $stmtNode->execute([$rootNodeId]);
    $descNodeId = $stmtNode->fetchColumn();
    
    if (!$descNodeId) {
        $descUuid = Uuid::v4()->toBinary();
        $descSlug = 'c' . $courseId . '-course-overview';
        $stmtCreateNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 13, 'Course Overview', ?, 0, ?, NOW(), NOW())");
        $stmtCreateNode->execute([$descUuid, $descSlug, $rootNodeId]);
        $descNodeId = $pdo->lastInsertId();
    } else {
        $pdo->prepare("UPDATE resource_node SET resource_type_id = 13 WHERE id = ?")->execute([$descNodeId]);
    }
    
    // Ensure resource_link exists for course description
    $stmtCheckLink = $pdo->prepare("SELECT id FROM resource_link WHERE resource_node_id = ? AND c_id = ?");
    $stmtCheckLink->execute([$descNodeId, $courseId]);
    if (!$stmtCheckLink->fetchColumn()) {
        $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())")->execute([$descNodeId, $courseId]);
    } else {
        $pdo->prepare("UPDATE resource_link SET visibility = 2, resource_type_group = 0 WHERE resource_node_id = ? AND c_id = ?")->execute([$descNodeId, $courseId]);
    }
    
    // Insert single clean description
    $escTitle = htmlspecialchars($courseTitle, ENT_QUOTES, 'UTF-8');
    $escDesc = htmlspecialchars($cDesc, ENT_QUOTES, 'UTF-8');
    $escCat = htmlspecialchars($cCategory, ENT_QUOTES, 'UTF-8');
    
    $cleanDescHtml = <<<HTML
<div class="course-description-wrapper" style="font-family: 'Inter', sans-serif; line-height: 1.7; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 28px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <span style="display: inline-block; background: #0284c7; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">$escCat</span>
        <h2 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 24px; font-weight: 700;">$escTitle — Certification Curriculum</h2>
        <p style="margin: 0; color: #94a3b8; font-size: 15px;">$escDesc</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px; font-weight: 600;">🎯 Key Learning Outcomes</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li>Master foundational principles, tools, and industry workflows for $escTitle</li>
                <li>Implement production-grade techniques with step-by-step guidance</li>
                <li>Analyze and resolve real-world edge cases and complex scenarios</li>
                <li>Prepare thoroughly for official certification and professional assessment</li>
            </ul>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px; font-weight: 600;">📋 Prerequisites & Requirements</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li>Basic familiarity with $escCat concepts</li>
                <li>Standard PC, Mac, or Linux workstation with modern browser</li>
                <li>Enthusiasm and dedication to complete all hands-on modules</li>
            </ul>
        </div>
    </div>
</div>
HTML;
    
    $stmtInsertDesc = $pdo->prepare("
        INSERT INTO c_course_description (resource_node_id, title, content, description_type, progress)
        VALUES (?, 'Course Overview & Objectives', ?, 1, 0)
        ON DUPLICATE KEY UPDATE content = VALUES(content), title = VALUES(title)
    ");
    $stmtInsertDesc->execute([$descNodeId, $cleanDescHtml]);
    
    // 2. Find or create Learning Path node
    $stmtLpNode = $pdo->prepare("SELECT id FROM resource_node WHERE parent_id = ? AND (title = 'learnpath' OR resource_type_id = 39) LIMIT 1");
    $stmtLpNode->execute([$rootNodeId]);
    $lpNodeId = $stmtLpNode->fetchColumn();
    
    if (!$lpNodeId) {
        $lpUuid = Uuid::v4()->toBinary();
        $lpSlug = 'c' . $courseId . '-learnpath';
        $stmtCreateLpNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 39, ?, ?, 0, ?, NOW(), NOW())");
        $stmtCreateLpNode->execute([$lpUuid, $courseTitle . ' — Complete Learning Path', $lpSlug, $rootNodeId]);
        $lpNodeId = $pdo->lastInsertId();
    } else {
        $pdo->prepare("UPDATE resource_node SET resource_type_id = 39 WHERE id = ?")->execute([$lpNodeId]);
    }
    
    // Ensure resource_link exists for LP
    $stmtCheckLpLink = $pdo->prepare("SELECT id FROM resource_link WHERE resource_node_id = ? AND c_id = ?");
    $stmtCheckLpLink->execute([$lpNodeId, $courseId]);
    if (!$stmtCheckLpLink->fetchColumn()) {
        $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())")->execute([$lpNodeId, $courseId]);
    } else {
        $pdo->prepare("UPDATE resource_link SET visibility = 2, resource_type_group = 0 WHERE resource_node_id = ? AND c_id = ?")->execute([$lpNodeId, $courseId]);
    }
    
    // Find or create c_lp record
    $stmtLp = $pdo->prepare("SELECT iid FROM c_lp WHERE resource_node_id = ? LIMIT 1");
    $stmtLp->execute([$lpNodeId]);
    $lpId = $stmtLp->fetchColumn();
    
    if (!$lpId) {
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
                ?, 2, ?, ?, '',
                0, 'embedded', 'UTF-8', 'Chamilo 2.0 Native LMS',
                'local', '', 1, '', 0,
                '', 'OSIAN Tech Academy', 0, 0, 0,
                1, 0, 0, 0,
                NOW(), NOW(), 1, 0,
                0, 0, 0
            )
        ");
        $stmtInsertLp->execute([$lpNodeId, $courseTitle . ' — Complete Learning Path', $cDesc]);
        $lpId = $pdo->lastInsertId();
    } else {
        $pdo->prepare("UPDATE c_lp SET resource_node_id = ?, title = ?, description = ? WHERE iid = ?")->execute([$lpNodeId, $courseTitle . ' — Complete Learning Path', $cDesc, $lpId]);
    }
    
    // 3. Create 5 sequential organized modules with dedicated Flysystem HTML documents
    $moduleTemplates = [
        [
            'num' => 1,
            'tag' => 'Fundamentals & Architecture',
            'badgeColor' => '#0284c7',
            'summary' => "Gain a complete foundational understanding of $courseTitle, core architecture, key principles, and essential workflows."
        ],
        [
            'num' => 2,
            'tag' => 'Core Techniques & Workflows',
            'badgeColor' => '#8b5cf6',
            'summary' => "Explore core implementation patterns, best-practice methodologies, and step-by-step hands-on configurations."
        ],
        [
            'num' => 3,
            'tag' => 'Hands-on Practice & Exercises',
            'badgeColor' => '#10b981',
            'summary' => "Apply your skills through realistic practical exercises, guided lab walkthroughs, and code examples."
        ],
        [
            'num' => 4,
            'tag' => 'Advanced Scenarios & Optimization',
            'badgeColor' => '#f59e0b',
            'summary' => "Tackle advanced edge cases, performance tuning, security best practices, and enterprise troubleshooting."
        ],
        [
            'num' => 5,
            'tag' => 'Mastery & Certification Review',
            'badgeColor' => '#ec4899',
            'summary' => "Review comprehensive key takeaways, examine practice assessment checklists, and complete your course certification review."
        ]
    ];
    
    $prevItemId = null;
    
    foreach ($moduleTemplates as $idx => $mod) {
        $order = $idx + 1;
        $modTitle = "Module {$mod['num']}: {$mod['tag']}";
        
        $modHtml = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$escTitle — $modTitle</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.75; color: #1e293b; padding: 36px 40px; max-width: 920px; margin: 0 auto; background: #ffffff; }
        .badge { display: inline-block; background: {$mod['badgeColor']}; color: #ffffff; padding: 5px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        h1 { color: #0f172a; font-size: 26px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-top: 0; }
        h2 { color: #1e293b; font-size: 20px; font-weight: 700; margin-top: 32px; border-left: 4px solid {$mod['badgeColor']}; padding-left: 12px; }
        p { font-size: 15px; color: #334155; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px 26px; margin: 24px 0; }
        .card h3 { margin-top: 0; color: #0f172a; font-size: 17px; }
        .card ul { margin: 0; padding-left: 22px; color: #475569; font-size: 14.5px; }
        .card li { margin-bottom: 8px; }
        .highlight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px 22px; margin: 20px 0; color: #1e40af; font-size: 14.5px; }
        .code { background: #0f172a; color: #38bdf8; padding: 18px 22px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13.5px; overflow-x: auto; white-space: pre-wrap; line-height: 1.6; }
    </style>
</head>
<body>
    <span class="badge">Module {$mod['num']} • $escCat</span>
    <h1>$escTitle — {$mod['tag']}</h1>
    <p>{$mod['summary']}</p>
    
    <div class="card">
        <h3>📌 Module Objectives & Key Concepts:</h3>
        <ul>
            <li>Understand the core architectural decisions behind <strong>$escTitle</strong>.</li>
            <li>Implement industry-proven patterns to achieve optimal reliability and efficiency.</li>
            <li>Follow along with hands-on examples and interactive walkthroughs.</li>
            <li>Verify your understanding through guided milestone checkpoints.</li>
        </ul>
    </div>

    <h2>Hands-on Implementation Guide:</h2>
    <div class="code">
# Step 1: Initialize the environment for $escTitle
curl -sSL https://learn.osian.tech/assets/setup.sh | bash

# Step 2: Validate configuration and workspace state
osian-cli check --course="$escTitle" --module={$mod['num']}

# Step 3: Run the interactive exercise
osian-cli start-lab --step={$mod['num']}
    </div>

    <div class="highlight-box">
        💡 <strong>Pro Tip:</strong> Ensure all prerequisite steps from previous modules are completed before proceeding to subsequent exercises.
    </div>
</body>
</html>
HTML;
        
        // Physical file hash
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
        
        // Create ResourceNode for this chapter document (resource_type_id = 17)
        $stmtNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 17, ?, ?, 0, ?, NOW(), NOW())");
        $stmtNode->execute([$binaryUuid, $modTitle, $slug, $rootNodeId]);
        $nodeId = $pdo->lastInsertId();
        
        // Create ResourceFile (access_url_id = NULL)
        $stmtRf = $pdo->prepare("INSERT INTO resource_file (resource_node_id, title, original_name, mime_type, size, created_at, updated_at, access_url_id) VALUES (?, ?, ?, 'text/html', ?, NOW(), NOW(), NULL)");
        $stmtRf->execute([$nodeId, $filename, $modTitle . '.html', strlen($modHtml)]);
        
        // Create ResourceLink (visibility = 0 so Documents tool stays completely clean!)
        $stmtRl = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 0, ?, 0, ?, NOW(), NOW())");
        $stmtRl->execute([$nodeId, $order, $courseId]);
        
        // Create c_document
        $stmtDoc = $pdo->prepare("INSERT INTO c_document (resource_node_id, title, filetype, readonly, template) VALUES (?, ?, 'file', 0, 0)");
        $stmtDoc->execute([$nodeId, $modTitle]);
        $docIid = $pdo->lastInsertId();
        
        // Create c_lp_item (path = $docIid)
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
                0, 100, 0, NULL,
                ?, NULL, ?, '',
                '', '', '', '', 0,
                '', 0, 0, 0,
                0, 0
            )
        ");
        $stmtLpItem->execute([$lpId, $nodeId, $modTitle, (string)$docIid, $prevItemId, $order]);
        $newItemId = $pdo->lastInsertId();
        
        if ($prevItemId !== null) {
            $pdo->exec("UPDATE c_lp_item SET next_item_id = $newItemId WHERE iid = $prevItemId");
        }
        
        $prevItemId = $newItemId;
    }
    
    $processed++;
    if ($processed % 25 === 0 || $processed === count($dbCourses)) {
        echo "  ✨ Processed $processed / " . count($dbCourses) . " courses...\n";
    }
}

echo "\n🎉 SUCCESS: All $processed courses have clean, single descriptions, hidden document lists, and 5 organized, content-rich Learning Path modules!\n";
