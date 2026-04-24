<?php
$uploadDir = 'uploads/';
$expireSeconds = 3600;

if (!isset($_GET['id'])) {
    header("HTTP/1.0 400 Bad Request");
    die("Bad Request");
}

$fileName = basename($_GET['id']);
$filePath = $uploadDir . $fileName;

if (!file_exists($filePath)) {
    header("HTTP/1.0 404 Not Found");
    die("Not Found");
}

if (time() - filemtime($filePath) > $expireSeconds) {
    header("HTTP/1.0 410 Gone");
    die("<h1>만료된 링크입니다.</h1><p>보안을 위해 사진 다운로드 기간(60분)이 지났습니다.</p>");
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($filePath);

header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="' . $fileName . '"');
header('Content-Length: ' . filesize($filePath));
readfile($filePath);
exit;
?>