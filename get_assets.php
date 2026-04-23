<?php
header('Content-Type: application/json');

// assets/stickers 폴더 안의 모든 png 파일을 찾아서 배열로 반환
$stickers = glob("assets/stickers/*.png");

// 윈도우 경로(\)를 웹 경로(/)로 통일
$stickers = array_map(function($path) {
    return str_replace('\\', '/', $path);
}, $stickers);

echo json_encode(['status' => 'success', 'data' => $stickers]);
?>