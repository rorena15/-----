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
}
if (file_put_contents($filePath, $imgData)) {
    // ── [지능형 주소 융합 로직] ──
    $host = $_SERVER['HTTP_HOST'];
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? "https" : "http";

    // 1. ngrok 터널링 감지 (가장 우선순위 높음)
    if (isset($_SERVER['HTTP_X_FORWARDED_HOST'])) {
        $host = $_SERVER['HTTP_X_FORWARDED_HOST'];
        // ngrok은 보통 https를 사용하므로 프로토콜 강제 지정 가능
        $protocol = (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : "https";
    } 
    // 2. 터널링이 없고 운영자가 localhost로 접속 중인 경우 LAN IP로 치환
    else if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
        $host = gethostbyname(gethostname());
        $port = $_SERVER['SERVER_PORT'];
        if ($port != '80' && $port != '443') {
            $host .= ":" . $port;
        }
    }

    $uri = rtrim(dirname($_SERVER['PHP_SELF']), '/\\');
    $fileUrl = $protocol . "://" . $host . $uri . "/" . $filePath;

    echo json_encode(['status' => 'success', 'url' => $fileUrl]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Save failed']);
}
?>