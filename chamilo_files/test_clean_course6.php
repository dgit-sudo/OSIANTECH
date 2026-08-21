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

echo "=== 1. CLEANING COURSE DESCRIPTIONS FOR COURSE 6 ===\n";
// Find course description node
$stmt = $pdo->prepare("SELECT id FROM resource_node WHERE parent_id = 144 AND (title = 'Course Overview' OR title = 'course_description' OR resource_type_id = 13) LIMIT 1");
$stmt->execute();
$descNodeId = $stmt->fetchColumn();

// Delete all existing descriptions for course 6 nodes
$pdo->exec("DELETE FROM c_course_description WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = 144 OR id = 144)");

$descContent = <<<HTML
<div class="course-description-wrapper" style="font-family: 'Inter', sans-serif; line-height: 1.7; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 30px; border-radius: 12px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 24px;">Oracle Admin I — Complete Certification Curriculum</h2>
        <p style="margin: 0; color: #94a3b8; font-size: 15px;">Master enterprise Oracle database architecture, configuration, user privileges, backup automation, and storage management.</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">🎯 Learning Objectives</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
                <li>Understand Oracle Database Instance & Memory Structures (SGA & PGA)</li>
                <li>Manage Physical Storage (Datafiles, Control Files, Redo Logs)</li>
                <li>Configure Tablespaces, Segments, and Extents</li>
                <li>Administer User Accounts, Roles, and Object Privileges</li>
                <li>Implement Backup & Recovery Strategies using RMAN</li>
            </ul>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">📋 Course Prerequisites</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
                <li>Basic understanding of Relational Database Concepts & SQL queries</li>
                <li>Familiarity with Command-Line Interface (Linux/Windows)</li>
                <li>Standard PC or Laptop with virtualization support</li>
            </ul>
        </div>
    </div>
</div>
HTML;

$stmtInsertDesc = $pdo->prepare("
    INSERT INTO c_course_description (resource_node_id, title, content, description_type, progress)
    VALUES (?, 'Course Overview & Objectives', ?, 1, 0)
");
$stmtInsertDesc->execute([$descNodeId, $descContent]);
echo "✅ Set exactly ONE clean Course Description for Course 6 (Node #$descNodeId)!\n";

echo "\n=== 2. REMOVING STANDALONE DOCUMENTS FROM DOCUMENTS TOOL ===\n";
// Delete all old standalone c_document rows for Course 6 nodes
$pdo->exec("DELETE FROM c_document WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = 144)");
// Also set visibility = 0 for any document links of course 6 so documents tool is empty
$pdo->exec("
    UPDATE resource_link rl
    JOIN resource_node rn ON rn.id = rl.resource_node_id
    SET rl.visibility = 0
    WHERE rl.c_id = 6 AND rn.resource_type_id = 17
");
echo "✅ Cleared and hidden standalone documents from Documents tool!\n";

echo "\n=== 3. REBUILDING LEARNING PATH MODULES WITH RICH INTERACTIVE CONTENT ===\n";
// Get LP for Course 6
$stmtLp = $pdo->prepare("SELECT iid FROM c_lp WHERE resource_node_id IN (SELECT id FROM resource_node WHERE parent_id = 144) LIMIT 1");
$stmtLp->execute();
$lpId = $stmtLp->fetchColumn();

echo "LP ID for Course 6: $lpId\n";

// Clear old items
$pdo->exec("DELETE FROM c_lp_item_view WHERE lp_item_id IN (SELECT iid FROM c_lp_item WHERE lp_id = $lpId)");
$pdo->exec("DELETE FROM c_lp_item WHERE lp_id = $lpId");

$modules = [
    [
        'title' => 'Module 1: Oracle Instance & Architecture Fundamentals',
        'content' => <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Module 1: Oracle Instance & Architecture Fundamentals</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { color: #1e293b; margin-top: 28px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
        .badge { display: inline-block; background: #0ea5e9; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <span class="badge">Module 1</span>
    <h1>Oracle Instance & Architecture Fundamentals</h1>
    <p>Welcome to Module 1 of <strong>Oracle Admin I</strong>. In this module, you will explore how an Oracle Database is structured, separating the memory instance from the physical disk storage.</p>
    
    <div class="card">
        <h3>🔑 Key Architectural Components:</h3>
        <ul>
            <li><strong>SGA (System Global Area):</strong> Shared memory area containing the Buffer Cache, Shared Pool, and Redo Log Buffer.</li>
            <li><strong>PGA (Program Global Area):</strong> Dedicated memory region allocated per server process.</li>
            <li><strong>Background Processes:</strong> DBWn (Database Writer), LGWR (Log Writer), CKPT (Checkpoint), SMON (System Monitor), and PMON (Process Monitor).</li>
        </ul>
    </div>

    <h2>Hands-on Commands:</h2>
    <div class="code">
-- Connect to SQL*Plus as SYSDBA
sqlplus / as sysdba

-- Check instance status
SELECT instance_name, status, database_status FROM v$instance;

-- View SGA component allocation
SHOW SGA;
    </div>
</body>
</html>
HTML
    ],
    [
        'title' => 'Module 2: Storage Structure, Tablespaces & Datafiles',
        'content' => <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Module 2: Storage Structure, Tablespaces & Datafiles</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { color: #1e293b; margin-top: 28px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
        .badge { display: inline-block; background: #8b5cf6; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <span class="badge">Module 2</span>
    <h1>Storage Structure, Tablespaces & Datafiles</h1>
    <p>Understand how logical database storage (tablespaces, segments, extents, blocks) maps to physical storage (datafiles).</p>
    
    <div class="card">
        <h3>Core Concepts:</h3>
        <ul>
            <li><strong>SYSTEM & SYSAUX:</strong> Mandatory administrative tablespaces.</li>
            <li><strong>UNDO:</strong> Manages read consistency and transaction rollbacks.</li>
            <li><strong>TEMP:</strong> Handles large sorting operations and hash joins.</li>
        </ul>
    </div>

    <h2>Creating a Custom Tablespace:</h2>
    <div class="code">
CREATE TABLESPACE app_data
DATAFILE '/u01/app/oracle/oradata/ORCL/app_data01.dbf'
SIZE 100M
AUTOEXTEND ON NEXT 50M MAXSIZE 2G;
    </div>
</body>
</html>
HTML
    ],
    [
        'title' => 'Module 3: Managing Users, Privileges & Security',
        'content' => <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Module 3: Managing Users, Privileges & Security</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { color: #1e293b; margin-top: 28px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
        .badge { display: inline-block; background: #10b981; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <span class="badge">Module 3</span>
    <h1>Managing Users, Privileges & Security</h1>
    <p>Learn user provisioning, password profiles, system privileges, object privileges, and role-based access control (RBAC).</p>
    
    <div class="card">
        <h3>Best Practices:</h3>
        <ul>
            <li>Never grant <code>DBA</code> role to application schemas.</li>
            <li>Use <code>CREATE ROLE</code> to bundle common permissions.</li>
            <li>Enforce password complexity using <code>CREATE PROFILE</code>.</li>
        </ul>
    </div>

    <h2>User Provisioning Example:</h2>
    <div class="code">
CREATE USER dev_user IDENTIFIED BY "SecurePass#2026"
DEFAULT TABLESPACE app_data
TEMPORARY TABLESPACE temp
QUOTA 500M ON app_data;

GRANT CREATE SESSION, CREATE TABLE TO dev_user;
    </div>
</body>
</html>
HTML
    ],
    [
        'title' => 'Module 4: Backup, Recovery & RMAN Basics',
        'content' => <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Module 4: Backup, Recovery & RMAN Basics</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { color: #1e293b; margin-top: 28px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
        .badge { display: inline-block; background: #f59e0b; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <span class="badge">Module 4</span>
    <h1>Backup, Recovery & RMAN Basics</h1>
    <p>Explore Recovery Manager (RMAN), ARCHIVELOG mode, and consistent hot/cold backups for enterprise disaster recovery.</p>
    
    <div class="card">
        <h3>Backup Strategy Checklist:</h3>
        <ul>
            <li>Ensure database is in <code>ARCHIVELOG</code> mode.</li>
            <li>Configure Fast Recovery Area (FRA).</li>
            <li>Schedule daily incremental and weekly full database backups.</li>
        </ul>
    </div>

    <h2>RMAN Command Line:</h2>
    <div class="code">
# Launch RMAN and connect to target database
rman target /

# Perform full backup with archivelogs
BACKUP DATABASE PLUS ARCHIVELOG DELETE INPUT;
    </div>
</body>
</html>
HTML
    ],
    [
        'title' => 'Module 5: Performance Tuning & Enterprise Monitoring',
        'content' => <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Module 5: Performance Tuning & Enterprise Monitoring</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { color: #1e293b; margin-top: 28px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
        .badge { display: inline-block; background: #ec4899; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <span class="badge">Module 5</span>
    <h1>Performance Tuning & Enterprise Monitoring</h1>
    <p>Master Automatic Workload Repository (AWR), Active Session History (ASH), and SQL execution plan diagnosis.</p>
    
    <div class="card">
        <h3>Diagnostic Tools:</h3>
        <ul>
            <li><strong>AWR Reports:</strong> Detailed snapshot comparison of top wait events and SQL consumption.</li>
            <li><strong>ADDM (Automatic Database Diagnostic Monitor):</strong> Automated tuning advice.</li>
            <li><strong>SQL Trace & TKPROF:</strong> Profiling slow SQL execution.</li>
        </ul>
    </div>

    <h2>Generating an AWR Report:</h2>
    <div class="code">
@?/rdbms/admin/awrrpt.sql
    </div>
</body>
</html>
HTML
    ]
];

$prevItemId = 0;
$itemIds = [];

foreach ($modules as $idx => $mod) {
    $order = $idx + 1;
    $title = $mod['title'];
    $content = $mod['content'];
    
    // Hash for Vich file
    $hash = md5('c6_clean_mod_' . $order . '_' . $title);
    $filename = $hash . '.html';
    $c1 = substr($hash, 0, 1);
    $c2 = substr($hash, 1, 1);
    $c3 = substr($hash, 2, 1);
    
    $dir = "/var/www/html/chamilo/var/upload/resource/$c1/$c2/$c3";
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    file_put_contents("$dir/$filename", $content);
    chmod("$dir/$filename", 0666);
    
    $slug = 'c6-mod-' . $order . '-' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title));
    
    $binaryUuid = Uuid::v4()->toBinary();
    
    // Create ResourceNode for this chapter document (resource_type_id = 17)
    $stmtNode = $pdo->prepare("
        INSERT INTO resource_node (uuid, creator_id, resource_type_id, title, slug, public, parent_id, created_at, updated_at)
        VALUES (?, 1, 17, ?, ?, 0, 144, NOW(), NOW())
    ");
    $stmtNode->execute([$binaryUuid, $title, $slug]);
    $nodeId = $pdo->lastInsertId();
    
    // Create ResourceFile (access_url_id = NULL)
    $stmtRf = $pdo->prepare("
        INSERT INTO resource_file (resource_node_id, title, original_name, mime_type, size, created_at, updated_at, access_url_id)
        VALUES (?, ?, ?, 'text/html', ?, NOW(), NOW(), NULL)
    ");
    $stmtRf->execute([$nodeId, $filename, $title . '.html', strlen($content)]);
    
    // Create ResourceLink (visibility = 0, display_order = $order so it does NOT appear in Documents tool!)
    $stmtRl = $pdo->prepare("
        INSERT INTO resource_link (resource_node_id, visibility, display_order, resource_type_group, c_id, created_at, updated_at)
        VALUES (?, 0, ?, 0, 6, NOW(), NOW())
    ");
    $stmtRl->execute([$nodeId, $order]);
    
    // Create c_document (fields: resource_node_id, title, filetype, readonly, template)
    $stmtDoc = $pdo->prepare("
        INSERT INTO c_document (resource_node_id, title, filetype, readonly, template)
        VALUES (?, ?, 'file', 0, 0)
    ");
    $stmtDoc->execute([$nodeId, $title]);
    $docIid = $pdo->lastInsertId();
    
    // Create c_lp_item (path = $docIid)
    $stmtLpItem = $pdo->prepare("
        INSERT INTO c_lp_item (lp_id, item_type, ref, title, path, display_order, parent_item_id, previous_item_id, next_item_id, max_score)
        VALUES (?, 'document', ?, ?, ?, ?, 0, ?, 0, 100)
    ");
    $stmtLpItem->execute([$lpId, $nodeId, $title, (string)$docIid, $order, $prevItemId]);
    $newItemId = $pdo->lastInsertId();
    
    if ($prevItemId > 0) {
        $pdo->exec("UPDATE c_lp_item SET next_item_id = $newItemId WHERE iid = $prevItemId");
    }
    
    $prevItemId = $newItemId;
    $itemIds[] = $newItemId;
    
    echo "  🎉 Created Module $order: $title (Doc #$docIid, Node #$nodeId, Item #$newItemId)\n";
}

echo "\n=== VERIFICATION COMPLETE FOR COURSE 6 ===\n";
