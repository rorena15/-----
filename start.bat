@echo off
chcp 65001 >nul
color 0E
title 📸 인생네컷 융합 서버 관리자

echo ===================================================
echo          인생네컷 융합 시스템 가동
echo ===================================================
echo.

:: 1. PHP 내장 서버를 백그라운드에서 실행 (8000번 포트)
start /b "PHP_SERVER" "C:\xampp\php\php.exe" -S 0.0.0.0:8000
echo [성공] 내부 서버 가동 완료 (Port: 8000)

:: 2. ngrok 터널 실행 (새 창으로 띄워 주소 확인용)
echo [알림] 외부 접속용 ngrok 터널을 생성합니다...
start "NGROK_TUNNEL" ngrok http 8000

echo.
echo ---------------------------------------------------
echo  [운영 방법]
echo  1. 새로 뜬 ngrok 창에서 'Forwarding' 주소를 확인하세요.
echo     (예: https://xxxx.ngrok-free.app)
echo  2. 학생들에게는 그 주소(또는 생성된 QR)를 안내하세요.
echo  3. 운영자님은 'localhost:8000'으로 접속해도 무방합니다.
echo ---------------------------------------------------
echo.
echo  ⚠️ 이 창과 ngrok 창을 모두 끄지 마세요!
echo.
pause