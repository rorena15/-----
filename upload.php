<?php
header('Content-Type: application/json');

// 보안: 최대 파일 크기 10MB 제한
define('MAX_SIZE_BYTES', 10 * 1024 * 1024);

$uploadDir = 'uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$raw = file_get_contents('php://input');
if (strlen($raw) > MAX_SIZE_BYTES * 1.4) { // base64는 원본의 ~1.37배
    echo json_encode(['status' => 'error', 'message' => 'File too large']);
    exit;
}

$data = json_decode($raw, true);

if (isset($data['image'])) {
    $imgData = $data['image'];

    // data URI 헤더 파싱 및 MIME 검증
    if (!preg_match('/^data:(image\/(png|jpeg|jpg|webp));base64,/', $imgData, $matches)) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid image format']);
        exit;
    }
    $ext = ($matches[2] === 'jpeg' || $matches[2] === 'jpg') ? 'jpg' : $matches[2];

    $imgData = preg_replace('/^data:image\/\w+;base64,/', '', $imgData);
    $imgData = str_replace(' ', '+', $imgData);
    $imgData = base64_decode($imgData, true);

    if ($imgData === false) {
        echo json_encode(['status' => 'error', 'message' => 'Decode failed']);
        exit;
    }

    // 실제 이미지 파일인지 재확인
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->buffer($imgData);
    if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'])) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid file type']);
        exit;
    }

    $fileName = 'life4cuts_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filePath = $uploadDir . $fileName;

    if (file_put_contents($filePath, $imgData)) {
        $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'];
        $uri = rtrim(dirname($_SERVER['PHP_SELF']), '/\\');
        $fileUrl = $protocol . "://" . $host . $uri . "/" . $filePath;

        echo json_encode(['status' => 'success', 'url' => $fileUrl]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Save failed']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No data']);
}
?>