<?php

/* For licensing terms, see /license.txt */

declare(strict_types=1);

namespace Chamilo\CoreBundle\Security\Authenticator;

use Chamilo\CoreBundle\Entity\User;
use Chamilo\CoreBundle\Entity\UserAuthSource;
use Chamilo\CoreBundle\Helpers\AccessUrlHelper;
use Chamilo\CoreBundle\Repository\Node\UserRepository;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class FirebaseSsoAuthenticator extends AbstractAuthenticator
{
    public const SOURCE = "firebase_sso_check";

    private const PROJECT_ID = "osiantech-7f0d7";
    private const CERTS_URL  = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
    private const CREATOR_ID = 1;

    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly AccessUrlHelper $accessUrlHelper,
    ) {}

    public function supports(Request $request): ?bool
    {
        // Only engage on our route AND when a token is actually present.
        // This avoids entering the failure pipeline (which crashes in
        // Chamilo LoginFailureSubscriber when no passport exists).
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

        $passport = new SelfValidatingPassport(
            new UserBadge(
                $email,
                function (string $email) use ($name): User {
                    $user = $this->userRepository->findOneBy(["email" => $email]);
                    if ($user instanceof User) {
                        if (!$user->hasAuthSourceByAuthentication(UserAuthSource::PLATFORM)) {
                            $user->addAuthSourceByAuthentication(UserAuthSource::PLATFORM, $this->accessUrlHelper->getCurrent());
                            $this->userRepository->updateUser($user);
                        }

                        return $user;
                    }

                    return $this->provisionUser($email, $name);
                }
            )
        );
        $passport->setAttribute("source", self::SOURCE);

        return $passport;
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
        
        // Hash a secure random password using BCRYPT instead of setPlainPassword
        // This ensures the database has a valid hashed password string
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
