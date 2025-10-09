/**
 * 토큰 저장소 - 파일 기반 (개발용)
 * 실제 서비스에서는 DB 사용 권장
 */

const fs = require('fs');
const path = require('path');

class TokenStore {
    constructor() {
        this.filePath = path.join(__dirname, '..', 'kakao-tokens.json');
        this.tokens = this.loadTokens();
    }

    // 파일에서 토큰 불러오기
    loadTokens() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                const tokens = JSON.parse(data);
                console.log(`토큰 저장소: ${Object.keys(tokens).length}개의 토큰을 불러왔습니다.`);
                return new Map(Object.entries(tokens));
            }
        } catch (error) {
            console.error('토큰 불러오기 실패:', error);
        }
        return new Map();
    }

    // 파일에 토큰 저장하기
    saveTokens() {
        try {
            const obj = Object.fromEntries(this.tokens);
            fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
            console.log('토큰이 파일에 저장되었습니다.');
        } catch (error) {
            console.error('토큰 저장 실패:', error);
        }
    }

    // 토큰 설정
    set(key, value) {
        this.tokens.set(key, value);
        this.saveTokens();
    }

    // 토큰 가져오기
    get(key) {
        return this.tokens.get(key);
    }

    // 토큰 존재 여부
    has(key) {
        return this.tokens.has(key);
    }

    // 토큰 삭제
    delete(key) {
        const result = this.tokens.delete(key);
        if (result) {
            this.saveTokens();
        }
        return result;
    }

    // 모든 항목 반환
    entries() {
        return this.tokens.entries();
    }

    // 크기
    get size() {
        return this.tokens.size;
    }
}

module.exports = new TokenStore();