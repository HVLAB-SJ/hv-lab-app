@echo off
echo ========================================
echo Railway Deployment Script for HV LAB APP
echo ========================================

echo.
echo Step 1: Adding files to git...
git add .

echo.
echo Step 2: Creating commit...
git commit -m "Deploy to Railway: %date% %time%"

echo.
echo Step 3: Pushing to git repository...
git push

echo.
echo Step 4: Deploying to Railway...
railway up

echo.
echo ========================================
echo Deployment Complete!
echo Your app should be available at https://hvlab.app
echo ========================================
pause