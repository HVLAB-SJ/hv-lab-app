@echo off
echo ======================================
echo HV LAB APP - BUILD AND DEPLOY SCRIPT
echo ======================================
echo.

echo [1/5] Building frontend...
cd frontend-source\interior-management-system\frontend
call npm run build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/5] Cleaning old files in public folder...
cd ..\..\..
powershell -Command "Remove-Item -Path public\* -Recurse -Force -ErrorAction SilentlyContinue"

echo.
echo [3/5] Copying build files to public folder...
powershell -Command "Copy-Item -Path 'frontend-source\interior-management-system\frontend\dist\*' -Destination 'public\' -Recurse -Force"

echo.
echo [4/5] Committing changes...
git add -A
git commit -m "Build and deploy frontend"

echo.
echo [5/5] Pushing to GitHub and Railway...
git push origin main
railway up --service hv-lab-app

echo.
echo ======================================
echo DEPLOYMENT COMPLETE!
echo ======================================
echo.
echo Build files are in: public/
echo Server serves from: public/
echo Access at: https://hvlab.app
echo.
pause