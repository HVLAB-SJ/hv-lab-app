@echo off
echo ========================================
echo   HV LAB App Deployment Script
echo ========================================
echo.

echo [1/4] Building frontend...
cd interior-management-system\frontend
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Copying files to public...
cd ..\..
powershell -Command "Remove-Item -Path 'public\*' -Recurse -Force -ErrorAction SilentlyContinue"
powershell -Command "Copy-Item -Path 'interior-management-system\frontend\dist\*' -Destination 'public\' -Recurse -Force"

echo.
echo [3/4] Committing to Git...
git add .
git commit -m "Deploy: Build and update public files"

echo.
echo [4/4] Pushing to GitHub...
git push

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
pause