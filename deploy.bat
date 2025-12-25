@echo off
echo ========================================
echo   HV LAB App - Firebase Direct Deploy
echo ========================================
echo.

echo [1/3] Building frontend...
cd interior-management-system\frontend
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Copying files to public...
cd ..\..
powershell -Command "Copy-Item -Path 'interior-management-system\frontend\dist\*' -Destination 'public\' -Recurse -Force"

echo.
echo [3/3] Deploying to Firebase...
call firebase deploy --only hosting

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
pause
