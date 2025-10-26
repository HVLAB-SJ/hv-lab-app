/**
 * HV-L 로고로부터 PWA 아이콘 생성 스크립트
 */

const fs = require('fs');
const path = require('path');

// Sharp 라이브러리 동적 import
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('❌ sharp 라이브러리가 설치되어 있지 않습니다.');
    console.log('📦 설치 중...');
    require('child_process').execSync('npm install sharp', { stdio: 'inherit' });
    sharp = require('sharp');
}

const sourceLogo = path.join(__dirname, 'source-logo.png');
const publicDir = path.join(__dirname, 'frontend-source', 'interior-management-system', 'frontend', 'public');

// 생성할 아이콘 사이즈
const iconSizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'favicon.png', size: 32 }
];

async function generateIcons() {
    console.log('🎨 아이콘 생성 시작...');
    console.log(`📁 소스 로고: ${sourceLogo}`);
    console.log(`📁 출력 디렉토리: ${publicDir}\n`);

    // 소스 로고 파일 확인
    if (!fs.existsSync(sourceLogo)) {
        console.error('❌ source-logo.png 파일을 찾을 수 없습니다.');
        process.exit(1);
    }

    // public 디렉토리 확인
    if (!fs.existsSync(publicDir)) {
        console.error('❌ public 디렉토리를 찾을 수 없습니다.');
        process.exit(1);
    }

    try {
        // 각 사이즈별 아이콘 생성
        for (const icon of iconSizes) {
            const outputPath = path.join(publicDir, icon.name);

            await sharp(sourceLogo)
                .resize(icon.size, icon.size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .png()
                .toFile(outputPath);

            console.log(`✅ ${icon.name} (${icon.size}x${icon.size}) 생성 완료`);
        }

        // SVG 아이콘도 생성 (간단한 SVG 버전)
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#E5E7EB"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="400" font-weight="bold" text-anchor="middle" fill="#000000">HV-L</text>
</svg>`;

        fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
        console.log(`✅ icon.svg 생성 완료`);

        console.log('\n🎉 모든 아이콘 생성이 완료되었습니다!');
    } catch (error) {
        console.error('❌ 아이콘 생성 중 오류 발생:', error);
        process.exit(1);
    }
}

generateIcons();
