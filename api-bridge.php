<?php
/**
 * Same-origin API bridge for www/sekarconstructions.com.
 * Proxies /api/* → Node API on this server (Host: api.sekarconstructions.com)
 * so careers/admin work when public DNS for api.* is missing.
 */
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*'));
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
    http_response_code(204);
    exit;
}

$path = isset($_GET['__path']) ? (string) $_GET['__path'] : '';
$path = str_replace('\\', '/', $path);
$path = ltrim($path, '/');
if ($path === '' || strpos($path, '..') !== false || preg_match('#^[a-zA-Z0-9._/-]+$#', $path) !== 1) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['code' => 'BAD_PROXY_PATH', 'message' => 'Invalid API path.']]);
    exit;
}

$query = $_GET;
unset($query['__path']);
$qs = http_build_query($query);
// HTTPS loopback: plain HTTP is redirected to https://api.* which has no public DNS.
$target = 'https://127.0.0.1/api/' . $path . ($qs !== '' ? ('?' . $qs) : '');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = null;
if (!in_array($method, ['GET', 'HEAD'], true)) {
    $body = file_get_contents('php://input');
}

$forwardHeaders = ['Host: api.sekarconstructions.com', 'Connection: close'];
$pass = [
    'HTTP_CONTENT_TYPE' => 'Content-Type',
    'HTTP_AUTHORIZATION' => 'Authorization',
    'HTTP_X_CSRF_TOKEN' => 'X-CSRF-Token',
    'HTTP_ACCEPT' => 'Accept',
    'HTTP_ACCEPT_LANGUAGE' => 'Accept-Language',
    'CONTENT_TYPE' => 'Content-Type',
];
foreach ($pass as $serverKey => $headerName) {
    if (!empty($_SERVER[$serverKey])) {
        $forwardHeaders[] = $headerName . ': ' . $_SERVER[$serverKey];
    }
}
if (!empty($_SERVER['HTTP_COOKIE'])) {
    $forwardHeaders[] = 'Cookie: ' . $_SERVER['HTTP_COOKIE'];
}
$forwardHeaders[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? 'www.sekarconstructions.com');
$forwardHeaders[] = 'X-Forwarded-Proto: https';

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => false,
    // Loopback cert is for api.*; skip verify so Host header routing works.
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
]);
if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['code' => 'PROXY_UPSTREAM_ERROR', 'message' => 'Upstream API unreachable: ' . $err]]);
    exit;
}

$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$rawBody = substr($response, $headerSize);

http_response_code($status > 0 ? $status : 502);

$skip = ['transfer-encoding', 'connection', 'keep-alive', 'content-length', 'content-encoding'];
foreach (explode("\r\n", $rawHeaders) as $line) {
    if (strpos($line, ':') === false) {
        continue;
    }
    [$name, $value] = array_map('trim', explode(':', $line, 2));
    $lname = strtolower($name);
    if (in_array($lname, $skip, true)) {
        continue;
    }
    // Avoid leaking upstream CORS; browser is same-origin to this bridge.
    if (strpos($lname, 'access-control-') === 0) {
        continue;
    }
    header($name . ': ' . $value, false);
}

echo $rawBody;
