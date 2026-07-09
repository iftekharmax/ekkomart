<?php
// ============================================================
// cPanel image upload endpoint
// Upload this file to your cPanel: public_html/api/upload.php
// Then set VITE_UPLOAD_BASE_URL in your app's .env to:
//   https://yourdomain.com/api
// ============================================================

// --- CONFIG ---
$SECRET_TOKEN = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";
$UPLOAD_DIR   = __DIR__ . "/../uploads";           // public_html/uploads
$PUBLIC_BASE  = "https://yourdomain.com/uploads";  // public URL prefix
$MAX_BYTES    = 10 * 1024 * 1024;                  // 10 MB
$ALLOWED      = ["jpg","jpeg","png","webp","gif","avif"];

// --- CORS ---
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: X-Auth, Content-Type");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }

header("Content-Type: application/json");

// --- AUTH ---
$auth = $_SERVER["HTTP_X_AUTH"] ?? "";
if (!hash_equals($SECRET_TOKEN, $auth)) {
  http_response_code(401);
  echo json_encode(["error" => "unauthorized"]); exit;
}

if (!is_dir($UPLOAD_DIR)) mkdir($UPLOAD_DIR, 0755, true);

// --- DELETE ---
if ($_SERVER["REQUEST_METHOD"] === "DELETE") {
  $body = json_decode(file_get_contents("php://input"), true);
  $url  = $body["url"] ?? "";
  if (!$url || strpos($url, $PUBLIC_BASE) !== 0) {
    http_response_code(400); echo json_encode(["error" => "bad url"]); exit;
  }
  $rel = substr($url, strlen($PUBLIC_BASE));
  $rel = preg_replace('#(^|/)\.\.(/|$)#', '', $rel);
  $abs = realpath($UPLOAD_DIR . $rel);
  if ($abs && strpos($abs, realpath($UPLOAD_DIR)) === 0 && is_file($abs)) @unlink($abs);
  echo json_encode(["ok" => true]); exit;
}

// --- UPLOAD ---
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405); echo json_encode(["error" => "method"]); exit;
}
if (empty($_FILES["file"])) {
  http_response_code(400); echo json_encode(["error" => "no file"]); exit;
}
$f = $_FILES["file"];
if ($f["error"] !== UPLOAD_ERR_OK) {
  http_response_code(400); echo json_encode(["error" => "upload error {$f['error']}"]); exit;
}
if ($f["size"] > $MAX_BYTES) {
  http_response_code(413); echo json_encode(["error" => "too large"]); exit;
}
$ext = strtolower(pathinfo($f["name"], PATHINFO_EXTENSION));
if (!in_array($ext, $ALLOWED, true)) {
  http_response_code(415); echo json_encode(["error" => "type not allowed"]); exit;
}

$folder = preg_replace('/[^a-z0-9_-]/i', '', $_POST["folder"] ?? "misc");
$sub    = $UPLOAD_DIR . "/" . $folder;
if (!is_dir($sub)) mkdir($sub, 0755, true);

$name = bin2hex(random_bytes(12)) . "." . $ext;
$dest = $sub . "/" . $name;
if (!move_uploaded_file($f["tmp_name"], $dest)) {
  http_response_code(500); echo json_encode(["error" => "move failed"]); exit;
}
echo json_encode(["url" => "$PUBLIC_BASE/$folder/$name"]);
