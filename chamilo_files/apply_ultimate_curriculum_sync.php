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

echo "=== CHAMILO 2.0 ULTIMATE CURRICULUM & TOC REBUILD (248 COURSES) ===\n";

$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

$pdo->exec("TRUNCATE TABLE c_course_description");
$pdo->exec("TRUNCATE TABLE c_lp_item_view");
$pdo->exec("TRUNCATE TABLE c_lp_item");
$pdo->exec("TRUNCATE TABLE c_lp_view");
$pdo->exec("TRUNCATE TABLE c_lp_category");
$pdo->exec("TRUNCATE TABLE c_lp");
$pdo->exec("TRUNCATE TABLE c_document");

// Delete all non-tool resource nodes of type 13, 17, 39
$pdo->exec("DELETE FROM resource_file WHERE resource_node_id IN (SELECT id FROM resource_node WHERE id NOT IN (SELECT resource_node_id FROM c_tool) AND resource_type_id IN (13, 17, 39))");
$pdo->exec("DELETE FROM resource_link WHERE resource_node_id IN (SELECT id FROM resource_node WHERE id NOT IN (SELECT resource_node_id FROM c_tool) AND resource_type_id IN (13, 17, 39))");
$pdo->exec("DELETE FROM resource_node WHERE id NOT IN (SELECT resource_node_id FROM c_tool) AND resource_type_id IN (13, 17, 39)");

// Ensure ALL c_tool nodes are resource_type_id = 11 (course_tools)
$pdo->exec("UPDATE resource_node SET resource_type_id = 11 WHERE id IN (SELECT resource_node_id FROM c_tool)");

$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
echo "✅ Wiped old data and set all course tool nodes to resource_type_id = 11 (course_tools).\n";

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
    $courseCode = $courseDb['code'];
    
    $catItem = $catByTitle[strtolower($courseTitle)] ?? [];
    $cCategory = $catItem['category'] ?? 'Technology & Professional Skills';
    $cDesc = $catItem['description'] ?? 'Master industry-standard skills, practical workflows, and production techniques in this comprehensive certification curriculum.';
    
    // 1. Ensure course root node (type 31) exists
    $rootNodeId = (int)$courseDb['resource_node_id'];
    $rootExists = $rootNodeId > 0 ? $pdo->query("SELECT id FROM resource_node WHERE id = $rootNodeId")->fetchColumn() : false;
    
    if (!$rootExists) {
        $courseUuid = Uuid::v4()->toBinary();
        $courseSlug = 'course-' . $courseId . '-' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $courseTitle)) . '-' . substr(md5(uniqid()), 0, 4);
        $stmtCreateCourseNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 31, ?, ?, 0, NULL, NOW(), NOW())");
        $stmtCreateCourseNode->execute([$courseUuid, $courseTitle, $courseSlug]);
        $rootNodeId = (int)$pdo->lastInsertId();
        $pdo->prepare("UPDATE course SET resource_node_id = ? WHERE id = ?")->execute([$rootNodeId, $courseId]);
    }
    
    // Ensure course root resource link exists
    $checkCourseLink = $pdo->query("SELECT id FROM resource_link WHERE resource_node_id = $rootNodeId AND c_id = $courseId")->fetchColumn();
    if (!$checkCourseLink) {
        $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())")->execute([$rootNodeId, $courseId]);
    }
    
    // Ensure all c_tool nodes have valid resource_node (parent_id = $rootNodeId, resource_type_id = 11) and link (visibility = 2)
    $tools = $pdo->query("SELECT * FROM c_tool WHERE c_id = $courseId")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($tools as $t) {
        $toolTitle = $t['title'];
        $nodeId = (int)$t['resource_node_id'];
        $nodeExists = $pdo->query("SELECT id FROM resource_node WHERE id = $nodeId")->fetchColumn();
        
        if (!$nodeExists) {
            $uuid = Uuid::v4()->toBinary();
            $slug = 'c' . $courseId . '-tool-' . $toolTitle . '-' . substr(md5(uniqid()), 0, 4);
            try {
                $stmt = $pdo->prepare("INSERT INTO resource_node (id, uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, ?, 1, 11, ?, ?, 0, ?, NOW(), NOW())");
                $stmt->execute([$nodeId, $uuid, $toolTitle, $slug, $rootNodeId]);
            } catch (Exception $e) {
                $stmt = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 11, ?, ?, 0, ?, NOW(), NOW())");
                $stmt->execute([$uuid, $toolTitle, $slug, $rootNodeId]);
                $newNodeId = (int)$pdo->lastInsertId();
                $pdo->prepare("UPDATE c_tool SET resource_node_id = ? WHERE iid = ?")->execute([$newNodeId, $t['iid']]);
                $nodeId = $newNodeId;
            }
        } else {
            $pdo->prepare("UPDATE resource_node SET parent_id = ?, resource_type_id = 11 WHERE id = ?")->execute([$rootNodeId, $nodeId]);
        }
        
        $linkId = $pdo->query("SELECT id FROM resource_link WHERE resource_node_id = $nodeId AND c_id = $courseId")->fetchColumn();
        if (!$linkId) {
            $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, ?, 0, ?, NOW(), NOW())")->execute([$nodeId, $t['position'], $courseId]);
        } else {
            $pdo->prepare("UPDATE resource_link SET visibility = 2 WHERE id = ?")->execute([$linkId]);
        }
    }
    
    // ----------------------------------------------------
    // 1. Single Clean Course Description (type 13)
    // ----------------------------------------------------
    $descUuid = Uuid::v4()->toBinary();
    $descSlug = 'c' . $courseId . '-overview-' . substr(md5(uniqid()), 0, 6);
    $stmtDescNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 13, 'Course Overview', ?, 0, ?, NOW(), NOW())");
    $stmtDescNode->execute([$descUuid, $descSlug, $rootNodeId]);
    $descNodeId = (int)$pdo->lastInsertId();
    
    $stmtDescLink = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())");
    $stmtDescLink->execute([$descNodeId, $courseId]);
    
    $escTitle = htmlspecialchars($courseTitle, ENT_QUOTES, 'UTF-8');
    $escDesc = htmlspecialchars($cDesc, ENT_QUOTES, 'UTF-8');
    $escCat = htmlspecialchars($cCategory, ENT_QUOTES, 'UTF-8');
    
    $cleanDescHtml = <<<HTML
<div class="course-description-wrapper" style="font-family: 'Inter', -apple-system, sans-serif; line-height: 1.7; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 28px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <span style="display: inline-block; background: #0284c7; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">$escCat</span>
        <h2 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 24px; font-weight: 700;">$escTitle — Professional Certification Curriculum</h2>
        <p style="margin: 0; color: #94a3b8; font-size: 15px;">$escDesc</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px; font-weight: 600;">🎯 Key Learning Outcomes</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li>Understand foundational principles, core concepts, and industry-standard workflows for $escTitle</li>
                <li>Apply professional methodology to solve real-world problems and optimize performance</li>
                <li>Gain hands-on experience through structured scenarios, guided walkthroughs, and practical exercises</li>
                <li>Achieve mastery and full readiness for formal certification assessment</li>
            </ul>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 17px; font-weight: 600;">📋 Curriculum Structure</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                <li><strong>Module 1:</strong> Fundamentals & Conceptual Architecture</li>
                <li><strong>Module 2:</strong> Core Principles & Implementation Standards</li>
                <li><strong>Module 3:</strong> Practical Application & Guided Walkthroughs</li>
                <li><strong>Module 4:</strong> Advanced Scenarios, Security & Optimization</li>
                <li><strong>Module 5:</strong> Mastery Review & Certification Assessment</li>
            </ul>
        </div>
    </div>
</div>
HTML;
    
    $stmtInsertDesc = $pdo->prepare("INSERT INTO c_course_description (resource_node_id, title, content, description_type, progress) VALUES (?, 'Course Overview & Objectives', ?, 1, 0)");
    $stmtInsertDesc->execute([$descNodeId, $cleanDescHtml]);
    
    // ----------------------------------------------------
    // 2. Exactly 1 Clean Learning Path (type 39)
    // ----------------------------------------------------
    $lpUuid = Uuid::v4()->toBinary();
    $lpSlug = 'c' . $courseId . '-lp-' . substr(md5(uniqid()), 0, 6);
    $stmtCreateLpNode = $pdo->prepare("INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at) VALUES (?, 1, 39, ?, ?, 0, ?, NOW(), NOW())");
    $stmtCreateLpNode->execute([$lpUuid, $courseTitle . ' — Complete Learning Path', $lpSlug, $rootNodeId]);
    $lpNodeId = (int)$pdo->lastInsertId();
    
    $stmtCreateLpLink = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, 1, 0, ?, NOW(), NOW())");
    $stmtCreateLpLink->execute([$lpNodeId, $courseId]);
    
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
    $lpId = (int)$pdo->lastInsertId();
    
    // ----------------------------------------------------
    // 3. Root c_lp_item (with Gedmo NestedSet root values)
    // ----------------------------------------------------
    $stmtRootItem = $pdo->prepare("
        INSERT INTO c_lp_item (
            lp_id, item_root, parent_item_id, item_type, ref, title, description, path,
            min_score, max_score, mastery_score,
            previous_item_id, next_item_id, lvl, display_order, prerequisite,
            parameters, launch_data, max_time_allowed, terms, search_did,
            audio, prerequisite_min_score, prerequisite_max_score,
            duration, export_allowed
        ) VALUES (
            ?, NULL, NULL, 'root', 0, 'root', '', 'root',
            0, 100, 0,
            1, 12, 0, 0, '',
            '', '', '', '', 0,
            '', 0, 0,
            0, 0
        )
    ");
    $stmtRootItem->execute([$lpId]);
    $rootItemId = (int)$pdo->lastInsertId();
    
    // Set item_root to itself
    $pdo->prepare("UPDATE c_lp_item SET item_root = ? WHERE iid = ?")->execute([$rootItemId, $rootItemId]);
    
    // ----------------------------------------------------
    // 4. Create 5 Sequential Modules with Rich Educational Curriculum
    // ----------------------------------------------------
    $moduleConfigs = [
        [
            'num' => 1,
            'tag' => 'Fundamentals & Architectural Overview',
            'badgeColor' => '#0284c7',
            'section1' => 'Core Conceptual Foundations',
            'section1_body' => "This introductory module establishes the core theoretical foundations, principles, and architectural layout for <strong>$escTitle</strong>. You will explore foundational domain knowledge, vocabulary, framework components, and standard operational cycles required to build a solid professional foundation.",
            'section2' => 'Essential Building Blocks & Key Principles',
            'points' => [
                "Understand the primary structural concepts and core workflow stages of <strong>$escTitle</strong>.",
                "Identify industry best-practice architectural patterns and standard project lifecycle phases.",
                "Explore essential terminology, configuration basics, and foundational mental models.",
                "Prepare for hands-on application by reviewing fundamental design patterns and standards."
            ]
        ],
        [
            'num' => 2,
            'tag' => 'Core Principles & Implementation Standards',
            'badgeColor' => '#8b5cf6',
            'section1' => 'Standard Methodologies & Technical Procedures',
            'section1_body' => "Module 2 transitions from conceptual foundations into standard implementation practices for <strong>$escTitle</strong>. You will examine standard operating procedures, component configurations, and step-by-step methodologies used by industry professionals.",
            'section2' => 'Implementation Checkpoints & Best Practices',
            'points' => [
                "Examine step-by-step technical procedures and configuration workflows.",
                "Apply established industry design patterns to ensure robust and maintainable deliverables.",
                "Analyze data flow, execution paths, and interaction models across components.",
                "Implement validation checkpoints to verify correct system state and compliance."
            ]
        ],
        [
            'num' => 3,
            'tag' => 'Practical Application & Guided Case Studies',
            'badgeColor' => '#10b981',
            'section1' => 'Applied Scenarios & Workflow Walkthroughs',
            'section1_body' => "This module focuses on practical application through structured case studies and scenario walkthroughs for <strong>$escTitle</strong>. You will analyze realistic project requirements, follow guided implementation exercises, and evaluate real-world problem-solving methodologies.",
            'section2' => 'Hands-on Learning Objectives & Case Study Analysis',
            'points' => [
                "Execute practical project workflows through structured, guided scenario walkthroughs.",
                "Deconstruct complex industry case studies and formulate practical technical solutions.",
                "Develop troubleshooting intuition by observing cause-and-effect in applied exercises.",
                "Consolidate practical experience to bridge theory with production execution."
            ]
        ],
        [
            'num' => 4,
            'tag' => 'Advanced Concepts, Security & Optimization',
            'badgeColor' => '#f59e0b',
            'section1' => 'Performance Tuning & Enterprise Resilience',
            'section1_body' => "Module 4 addresses advanced concepts, enterprise optimization, and reliability considerations in <strong>$escTitle</strong>. You will explore performance tuning, defensive design, edge-case mitigation, and security best practices to ensure high availability and scalability.",
            'section2' => 'Optimization Strategies & Defensive Best Practices',
            'points' => [
                "Identify common bottlenecks, resource constraints, and performance degradation triggers.",
                "Implement proactive optimization techniques to achieve optimal speed and efficiency.",
                "Incorporate defensive strategies, audit mechanisms, and industry security standards.",
                "Analyze and resolve challenging edge cases, anomalous conditions, and complex failures."
            ]
        ],
        [
            'num' => 5,
            'tag' => 'Mastery Synthesis & Certification Assessment',
            'badgeColor' => '#ec4899',
            'section1' => 'Curriculum Synthesis & Key Takeaways',
            'section1_body' => "Congratulations on completing the comprehensive training curriculum for <strong>$escTitle</strong>! This final module synthesizes key concepts from all previous lessons, provides a comprehensive mastery review checklist, and guides you through final preparation for certification assessment.",
            'section2' => 'Certification Readiness & Self-Assessment Checklist',
            'points' => [
                "Review key theoretical principles and architectural patterns covered across all modules.",
                "Validate comprehensive domain readiness against the standard certification criteria.",
                "Reflect on practical case studies and advanced optimization strategies.",
                "Complete self-assessment checkpoints to confirm subject matter mastery."
            ]
        ]
    ];
    
    $left = 2;
    
    foreach ($moduleConfigs as $idx => $mod) {
        $order = $idx + 1;
        $rgt = $left + 1;
        $modTitle = "Module {$mod['num']}: {$mod['tag']}";
        
        $bulletHtml = '';
        foreach ($mod['points'] as $pt) {
            $bulletHtml .= "<li style="margin-bottom: 10px; color: #334155; font-size: 15px; line-height: 1.7;">$pt</li>";
        }
        
        $modHtml = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>$escTitle — $modTitle</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.75; color: #1e293b; padding: 40px; max-width: 960px; margin: 0 auto; background: #ffffff; }
        .badge { display: inline-block; background: {$mod['badgeColor']}; color: #ffffff; padding: 5px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
        h1 { color: #0f172a; font-size: 26px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-top: 0; margin-bottom: 20px; }
        h2 { color: #0f172a; font-size: 19px; font-weight: 700; margin-top: 30px; margin-bottom: 14px; border-left: 4px solid {$mod['badgeColor']}; padding-left: 14px; }
        p { font-size: 15.5px; color: #334155; line-height: 1.8; margin-bottom: 18px; }
        .content-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 28px; margin: 24px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .content-card h3 { margin-top: 0; color: #0f172a; font-size: 17px; font-weight: 700; margin-bottom: 14px; }
        .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 24px; margin: 24px 0; color: #166534; font-size: 15px; line-height: 1.7; }
        .checklist-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin: 24px 0; color: #1e40af; font-size: 15px; line-height: 1.7; }
    </style>
</head>
<body>
    <span class="badge">Module {$mod['num']} • $escCat</span>
    <h1>$escTitle</h1>
    <h2>{$mod['section1']}</h2>
    <p>{$mod['section1_body']}</p>
    
    <div class="content-card">
        <h3>📖 {$mod['section2']}</h3>
        <ul style="margin: 0; padding-left: 24px;">
            $bulletHtml
        </ul>
    </div>

    <div class="checklist-box">
        💡 <strong>Key Learning Takeaway:</strong> Diligently review and apply these principles before moving to the next section. Active reflection reinforces conceptual retention and practical execution.
    </div>
</body>
</html>
HTML;
        
        $hash = md5("c{$courseId}_v3_mod_{$order}_{$modTitle}");
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
        
        // ResourceFile
        $stmtRf = $pdo->prepare("INSERT INTO resource_file (resource_node_id, title, original_name, mime_type, size, created_at, updated_at, access_url_id) VALUES (?, ?, ?, 'text/html', ?, NOW(), NOW(), NULL)");
        $stmtRf->execute([$nodeId, $filename, $modTitle . '.html', strlen($modHtml)]);
        
        // ResourceLink (visibility = 2)
        $stmtRl = $pdo->prepare("INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at) VALUES (?, 2, ?, 0, ?, NOW(), NOW())");
        $stmtRl->execute([$nodeId, $order, $courseId]);
        
        // c_document
        $stmtDoc = $pdo->prepare("INSERT INTO c_document (resource_node_id, title, filetype, readonly, template) VALUES (?, ?, 'file', 0, 0)");
        $stmtDoc->execute([$nodeId, $modTitle]);
        $docIid = (int)$pdo->lastInsertId();
        
        // c_lp_item with Gedmo NestedSet tree mapping
        $stmtLpItem = $pdo->prepare("
            INSERT INTO c_lp_item (
                lp_id, item_root, parent_item_id, item_type, ref, title, description, path,
                min_score, max_score, mastery_score,
                previous_item_id, next_item_id, lvl, display_order, prerequisite,
                parameters, launch_data, max_time_allowed, terms, search_did,
                audio, prerequisite_min_score, prerequisite_max_score,
                duration, export_allowed
            ) VALUES (
                ?, ?, ?, 'document', ?, ?, '', ?,
                0, 100, 0,
                ?, ?, 1, ?, '',
                '', '', '', '', 0,
                '', 0, 0,
                0, 0
            )
        ");
        $stmtLpItem->execute([$lpId, $rootItemId, $rootItemId, $nodeId, $modTitle, (string)$docIid, $left, $rgt, $order]);
        
        $left += 2;
    }
    
    $processed++;
    if ($processed % 25 === 0 || $processed === count($dbCourses)) {
        echo "  ✨ Processed $processed / " . count($dbCourses) . " courses...\n";
    }
}

echo "\n🎉 SUCCESS: All $processed courses rebuilt with Gedmo Tree TOC navigation and professional educational curriculum!\n";
