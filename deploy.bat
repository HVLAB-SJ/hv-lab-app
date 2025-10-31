@echo off
echo ========================================
echo 자동 빌드 및 배포 스크립트
echo ========================================
echo.

REM 프론트엔드 빌드
echo [1/5] 프론트엔드 빌드 중...
cd "C:\Users\kim_s\Desktop\HV LAB app\interior-management-system\frontend"
call npm run build
if %errorlevel% neq 0 (
    echo 빌드 실패!
    pause
    exit /b %errorlevel%
)
echo 빌드 완료!
echo.

REM 빌드 파일 복사
echo [2/5] 빌드 파일 복사 중...
cd "C:\Users\kim_s\Desktop\HV LAB app"
powershell -Command "Copy-Item -Path 'interior-management-system\frontend\dist\*' -Destination 'public\' -Recurse -Force"
echo 복사 완료!
echo.

REM Git 상태 확인
echo [3/5] Git 변경사항 추가 중...
git add .
echo.

REM Git 커밋
echo [4/5] Git 커밋 중...
set /p commit_message="커밋 메시지를 입력하세요 (기본: Update): "
if "%commit_message%"=="" set commit_message=Update

git commit -m "%commit_message%"
if %errorlevel% neq 0 (
    echo 커밋할 변경사항이 없거나 실패했습니다.
    echo 계속 진행합니다...
)
echo.

REM Git 푸시
echo [5/5] Git 푸시 및 Railway 배포 중...
git push
if %errorlevel% neq 0 (
    echo Git 푸시 실패!
    pause
    exit /b %errorlevel%
)
echo.

echo ========================================
echo 배포 완료!
echo Railway에서 자동으로 배포가 시작됩니다.
echo ========================================
echo.

REM Railway 배포 상태 확인 (선택사항)
set /p check_status="Railway 배포 로그를 확인하시겠습니까? (y/n): "
if /i "%check_status%"=="y" (
    railway logs
)

pause
