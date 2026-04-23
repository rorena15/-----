<?php
header('Content-Type: application/json');

$uploadDir = 'uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$data = json_decode(file_get_contents('php://input'), true);

if (isset($data['image'])) {
    $imgData = $data['image'];
    $imgData = str_replace('data:image/png;base64,', '', $imgData);
    $imgData = str_replace(' ', '+', $imgData);
    $imgData = base64_decode($imgData);

    if ($imgData === false) {
        echo json_encode(['status' => 'error', 'message' => 'Decode failed']);
        exit;
    }

    $fileName = 'life4cuts_' . uniqid() . '.png';
    $filePath = $uploadDir . $fileName;

    if (file_put_contents($filePath, $imgData)) {
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
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