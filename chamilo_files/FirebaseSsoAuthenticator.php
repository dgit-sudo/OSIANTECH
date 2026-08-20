<?php

/* For licensing terms, see /license.txt */

declare(strict_types=1);

namespace Chamilo\CoreBundle\Security\Authenticator;

use Chamilo\CoreBundle\Entity\User;
use Chamilo\CoreBundle\Entity\UserAuthSource;
use Chamilo\CoreBundle\Helpers\AccessUrlHelper;
use Chamilo\CoreBundle\Repository\Node\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Uid\Uuid;

class FirebaseSsoAuthenticator extends AbstractAuthenticator
{
    public const SOURCE = "firebase_sso_check";

    private const PROJECT_ID = "osiantech-7f0d7";
    private const CERTS_URL  = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
    private const CREATOR_ID = 1;

    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly AccessUrlHelper $accessUrlHelper,
        private readonly EntityManagerInterface $entityManager,
    ) {}

    public function supports(Request $request): ?bool
    {
        return self::SOURCE === $request->attributes->get("_route")
            && "" !== (string) ($request->query->get("token") ?? $request->request->get("token") ?? "");
    }

    public function authenticate(Request $request): Passport
    {
        $token = (string) ($request->query->get("token") ?? $request->request->get("token") ?? "");

        $payload = $this->verifyFirebaseToken($token);
        $email = strtolower(trim((string) ($payload["email"] ?? "")));
        if ("" === $email) {
            throw new AuthenticationException("Token has no email claim.");
        }

        $name = trim((string) ($payload["name"] ?? ""));
        $uid  = trim((string) ($payload["sub"] ?? ""));

        $passport = new SelfValidatingPassport(
            new UserBadge(
                $email,
                function (string $email) use ($name, $uid): User {
                    $user = $this->userRepository->findOneBy(["email" => $email]);
                    if ($user instanceof User) {
                        if (!$user->hasAuthSourceByAuthentication(UserAuthSource::PLATFORM)) {
                            $user->addAuthSourceByAuthentication(UserAuthSource::PLATFORM, $this->accessUrlHelper->getCurrent());
                            $this->userRepository->updateUser($user);
                        }
                    } else {
                        $user = $this->provisionUser($email, $name);
                    }

                    // Synchronize ONLY purchased courses for this student
                    $this->syncUserPurchasedCourses($user, $uid, $email);

                    return $user;
                }
            )
        );
        $passport->setAttribute("source", self::SOURCE);

        return $passport;
    }

    private function syncUserPurchasedCourses(User $user, string $uid, string $email): void
    {
        try {
            $ctx = stream_context_create([
                "http" => [
                    "timeout" => 5,
                    "header"  => "Accept: application/json\r\nUser-Agent: Chamilo-SSO/2.0\r\n"
                ],
                "ssl" => [
                    "verify_peer" => false,
                    "verify_peer_name" => false
                ]
            ]);

            $url = "https://osian.tech/api/profile/" . urlencode($uid) . "/lms-courses?email=" . urlencode($email);
            $raw = @file_get_contents($url, false, $ctx);
            if (false === $raw) {
                return;
            }

            $data = json_decode($raw, true);
            if (!is_array($data) || empty($data["courses"])) {
                return;
            }

            $conn = $this->entityManager->getConnection();
            $userId = (int) $user->getId();

            $defaultTools = [
                ["agenda", 1, 0],
                ["announcement", 2, 1],
                ["student_publication", 4, 2],
                ["attendance", 5, 3],
                ["blog", 6, 4],
                ["chat", 7, 5],
                ["course_description", 8, 6],
                ["course_homepage", 9, 7],
                ["course_progress", 10, 8],
                ["course_tool", 11, 9],
                ["document", 13, 10],
                ["dropbox", 14, 11],
                ["quiz", 15, 12],
                ["forum", 16, 13],
                ["glossary", 18, 14],
                ["gradebook", 19, 15],
                ["group", 20, 16],
                ["learnpath", 21, 17],
                ["link", 22, 18],
                ["course_maintenance", 23, 19],
                ["member", 24, 20],
                ["notebook", 26, 21],
                ["portfolio", 28, 22],
                ["course_setting", 30, 23],
                ["survey", 32, 24],
                ["tracking", 35, 25],
                ["wiki", 39, 26],
            ];

            // Clear old enrollments and sync only active purchased courses
            $conn->executeStatement("DELETE FROM course_rel_user WHERE user_id = ?", [$userId]);

            foreach ($data["courses"] as $c) {
                $code  = trim((string) ($c["courseCode"] ?? ("OSIAN_" . $c["courseId"])));
                $title = trim((string) ($c["courseTitle"] ?? ("Course " . $c["courseId"])));
                $rawCode = str_replace("_", "", $code);
                $slug  = strtolower(trim((string) preg_replace('/[^A-Za-z0-9-]+/', '-', $title), '-')) ?: ('course-' . $code);

                // 1. Find course by code, rawCode, or title
                $courseRow = $conn->fetchAssociative(
                    "SELECT id, resource_node_id FROM course WHERE code = ? OR code = ? OR visual_code = ? OR title = ? LIMIT 1",
                    [$code, $rawCode, $code, $title]
                );

                $courseId = null;
                $nodeId = null;

                if ($courseRow && !empty($courseRow["id"])) {
                    $courseId = (int) $courseRow["id"];
                    $nodeId = !empty($courseRow["resource_node_id"]) ? (int) $courseRow["resource_node_id"] : null;
                } else {
                    // Create Course ResourceNode with UUIDv4
                    $binaryUuid = Uuid::v4()->toBinary();
                    $conn->executeStatement(
                        "INSERT INTO resource_node (resource_type_id, creator_id, title, slug, level, created_at, updated_at, public, uuid)
                         VALUES (31, 1, ?, ?, 1, NOW(), NOW(), 1, ?)",
                        [$title, $slug, $binaryUuid]
                    );
                    $nodeId = (int) $conn->lastInsertId();
                    $path = $slug . '-' . $nodeId . '/';
                    $conn->executeStatement("UPDATE resource_node SET path = ? WHERE id = ?", [$path, $nodeId]);

                    // Create course record with resource_node_id
                    $conn->executeStatement(
                        "INSERT INTO course (resource_node_id, code, title, visual_code, directory, course_language, visibility, video_url, sticky, creation_date, subscribe, unsubscribe, popularity)
                         VALUES (?, ?, ?, ?, ?, 'english', 3, '', 0, NOW(), 1, 0, 0)",
                        [$nodeId, $code, $title, $code, $code]
                    );
                    $courseId = (int) $conn->lastInsertId();
                }

                if ($courseId > 0 && $nodeId > 0 && $userId > 0) {
                    // 2. Link course to Access URL (Portal 1)
                    try {
                        $conn->executeStatement(
                            "INSERT INTO access_url_rel_course (access_url_id, c_id) VALUES (1, ?) ON DUPLICATE KEY UPDATE c_id = ?",
                            [$courseId, $courseId]
                        );
                    } catch (\Throwable $_e) {}

                    // 3. Seed all 27 standard tools in c_tool with child ResourceNodes
                    foreach ($defaultTools as $dt) {
                        [$tTitle, $tId, $pos] = $dt;
                        $toolRow = $conn->fetchAssociative("SELECT iid, resource_node_id FROM c_tool WHERE c_id = ? AND tool_id = ? LIMIT 1", [$courseId, $tId]);

                        $tNodeId = !empty($toolRow["resource_node_id"]) ? (int) $toolRow["resource_node_id"] : null;
                        if (empty($tNodeId)) {
                            $tUuid = Uuid::v4()->toBinary();
                            $conn->executeStatement(
                                "INSERT INTO resource_node (resource_type_id, creator_id, parent_id, title, slug, level, created_at, updated_at, public, uuid)
                                 VALUES (?, 1, ?, ?, ?, 2, NOW(), NOW(), 1, ?)",
                                [$tId, $nodeId, $tTitle, $tTitle, $tUuid]
                            );
                            $tNodeId = (int) $conn->lastInsertId();
                            $tPath = 'course-' . $courseId . '/' . $tTitle . '-' . $tNodeId . '/';
                            $conn->executeStatement("UPDATE resource_node SET path = ? WHERE id = ?", [$tPath, $tNodeId]);
                        }

                        if ($toolRow) {
                            $conn->executeStatement("UPDATE c_tool SET resource_node_id = ? WHERE iid = ?", [$tNodeId, $toolRow["iid"]]);
                        } else {
                            $conn->executeStatement(
                                "INSERT INTO c_tool (resource_node_id, c_id, tool_id, title, position) VALUES (?, ?, ?, ?, ?)",
                                [$tNodeId, $courseId, $tId, $tTitle, $pos]
                            );
                        }
                    }

                    // 4. Enroll student into this purchased course (status 5 = student)
                    $conn->executeStatement(
                        "INSERT INTO course_rel_user (c_id, user_id, relation_type, status, progress)
                         VALUES (?, ?, 0, 5, 0)
                         ON DUPLICATE KEY UPDATE status = 5",
                        [$courseId, $userId]
                    );
                }
            }
        } catch (\Throwable $e) {
            error_log("[Chamilo SSO Course Sync] " . $e->getMessage());
        }
    }

    private function verifyFirebaseToken(string $jwt): array
    {
        $certs = $this->fetchGoogleCerts();
        if (empty($certs)) {
            throw new AuthenticationException("Could not fetch Google certificates.");
        }

        $parts = explode(".", $jwt);
        if (3 !== count($parts)) {
            throw new AuthenticationException("Malformed token.");
        }
        [$h, $b, $s] = $parts;

        $header  = json_decode($this->b64url($h), true);
        $payload = json_decode($this->b64url($b), true);
        $sig     = $this->b64url($s);

        if (!is_array($header) || !is_array($payload) || empty($header["kid"]) || ("RS256" !== ($header["alg"] ?? ""))) {
            throw new AuthenticationException("Invalid token header.");
        }
        if (!isset($certs[$header["kid"]])) {
            throw new AuthenticationException("Unknown signing key.");
        }

        $pub = openssl_pkey_get_public($certs[$header["kid"]]);
        if (!$pub) {
            throw new AuthenticationException("Cannot parse signing key.");
        }
        if (1 !== openssl_verify($h . "." . $b, $sig, $pub, OPENSSL_ALGO_SHA256)) {
            throw new AuthenticationException("Signature verification failed.");
        }

        $now = time();
        if (($payload["aud"] ?? "") !== self::PROJECT_ID) {
            throw new AuthenticationException("Invalid audience.");
        }
        if (($payload["iss"] ?? "") !== "https://securetoken.google.com/" . self::PROJECT_ID) {
            throw new AuthenticationException("Invalid issuer.");
        }
        if (empty($payload["sub"])) {
            throw new AuthenticationException("Invalid subject.");
        }
        if (($payload["exp"] ?? 0) < ($now - 60)) {
            throw new AuthenticationException("Token expired.");
        }

        return $payload;
    }

    private function fetchGoogleCerts(): array
    {
        $cacheFile = sys_get_temp_dir() . "/google_firebase_certs.json";
        if (is_file($cacheFile) && (filemtime($cacheFile) + 3600) > time()) {
            $cached = json_decode((string) @file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached)) {
                return $cached;
            }
        }

        $ctx = stream_context_create(["http" => ["timeout" => 5]]);
        $raw = @file_get_contents(self::CERTS_URL, false, $ctx);
        if (false === $raw) {
            return [];
        }
        $certs = json_decode($raw, true);
        if (is_array($certs) && !empty($certs)) {
            @file_put_contents($cacheFile, $raw);
            return $certs;
        }

        return [];
    }

    private function provisionUser(string $email, string $name): User
    {
        $first = "" !== $name ? explode(" ", $name)[0] : ucfirst(explode("@", $email)[0]);
        $last  = ("" !== $name && str_contains($name, " ")) ? trim(substr($name, strlen($first))) : "Student";
        $base  = preg_replace("/[^a-zA-Z0-9_]/", "", explode("@", $email)[0]);
        $username = $base . "_" . substr(md5(uniqid("", true)), 0, 4);

        $user = $this->userRepository->createUser();
        $user->setEmail($email);
        $user->setUsername($username);
        $user->setFirstname($first);
        $user->setLastname($last);
        $user->setStatus(5);
        $user->setActive(1);
        $user->setRoles(["ROLE_STUDENT"]);
        $user->setPassword(password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT));
        $user->setCreatorId(self::CREATOR_ID);
        $user->addAuthSourceByAuthentication(UserAuthSource::PLATFORM, $this->accessUrlHelper->getCurrent());

        $this->userRepository->updateUser($user);

        return $user;
    }

    private function b64url(string $data): string
    {
        $r = strlen($data) % 4;
        if ($r) {
            $data .= str_repeat("=", 4 - $r);
        }
        return (string) base64_decode(strtr($data, "-_", "+/"), true);
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        return new RedirectResponse("https://learn.osian.tech/");
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        if ("1" === (string) $request->query->get("debug")) {
            return new Response("SSO FAILED: " . $exception->getMessage(), Response::HTTP_FORBIDDEN);
        }

        return new RedirectResponse("https://osian.tech/auth?error=sso_failed");
    }
}
