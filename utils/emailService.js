/**
 * 네이버 메일 확인 및 견적문의 파싱 서비스
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { db } = require('../server/config/database');
require('dotenv').config();

class EmailService {
  constructor() {
    this.imap = null;
    this.isChecking = false;
    this.lastCheckedMessageId = null;

    // 네이버 IMAP 설정
    this.config = {
      user: process.env.NAVER_EMAIL || 'hv_lab@naver.com',
      password: process.env.NAVER_EMAIL_PASSWORD || '',
      host: 'imap.naver.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };

    if (!this.config.password) {
      console.warn('⚠️ 네이버 이메일 비밀번호가 설정되지 않았습니다. .env 파일에 NAVER_EMAIL_PASSWORD를 추가하세요.');
    } else {
      console.log('✅ 이메일 서비스가 초기화되었습니다.');
      console.log(`📧 이메일: ${this.config.user}`);
    }
  }

  /**
   * 새 견적문의 메일 확인
   */
  async checkNewQuoteInquiries() {
    if (this.isChecking) {
      console.log('⏳ 이미 메일을 확인 중입니다...');
      return;
    }

    if (!this.config.password) {
      console.log('⚠️ 이메일 비밀번호가 설정되지 않아 메일 확인을 건너뜁니다.');
      return;
    }

    this.isChecking = true;
    console.log('📬 새로운 견적문의 메일을 확인합니다...');

    return new Promise((resolve, reject) => {
      this.imap = new Imap(this.config);

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            console.error('❌ INBOX 열기 실패:', err);
            this.cleanup();
            reject(err);
            return;
          }

          // 제목에 "[HV LAB] 견적상담문의에 새 응답이 접수되었습니다." 포함된 모든 메일 검색
          // 최근 30일 이내의 메일만 검색
          const searchCriteria = [
            ['SINCE', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)], // 최근 30일
            ['SUBJECT', '[HV LAB] 견적상담문의에 새 응답이 접수되었습니다.']
          ];

          this.imap.search(searchCriteria, (err, results) => {
            if (err) {
              console.error('❌ 메일 검색 실패:', err);
              this.cleanup();
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log('📭 새로운 견적문의 메일이 없습니다.');
              this.cleanup();
              resolve([]);
              return;
            }

            console.log(`📨 ${results.length}개의 새로운 견적문의 메일을 발견했습니다.`);

            const fetch = this.imap.fetch(results, {
              bodies: '',
              markSeen: false  // 읽음 처리하지 않음 (중복 체크는 DB에서 처리)
            });

            const emails = [];

            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream, info) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('❌ 메일 파싱 실패:', err);
                    return;
                  }

                  try {
                    const inquiry = this.parseQuoteInquiryEmail(parsed);
                    if (inquiry) {
                      await this.saveQuoteInquiry(inquiry);
                      emails.push(inquiry);
                      console.log(`✅ 견적문의 저장 완료: ${inquiry.name}`);
                    }
                  } catch (error) {
                    console.error('❌ 견적문의 저장 실패:', error);
                  }
                });
              });
            });

            fetch.once('error', (err) => {
              console.error('❌ 메일 가져오기 실패:', err);
              this.cleanup();
              reject(err);
            });

            fetch.once('end', () => {
              console.log('✅ 메일 확인 완료');
              this.cleanup();
              resolve(emails);
            });
          });
        });
      });

      this.imap.once('error', (err) => {
        console.error('❌ IMAP 연결 오류:', err);
        this.cleanup();
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('📪 IMAP 연결 종료');
      });

      this.imap.connect();
    });
  }

  /**
   * 견적문의 이메일 파싱
   */
  parseQuoteInquiryEmail(parsed) {
    try {
      const text = parsed.text || '';
      const html = parsed.html || '';

      // 이메일 본문에서 정보 추출
      // 아입웹 폼 형식에 맞춰 파싱 (실제 이메일 형식에 따라 조정 필요)

      const inquiry = {
        name: '',
        phone: '',
        email: '',
        address: '',
        projectType: '',
        budget: '',
        message: '',
        rawEmail: text
      };

      // 이름 추출
      const nameMatch = text.match(/이름[:\s]*([^\n]+)/i) ||
                        text.match(/성함[:\s]*([^\n]+)/i);
      if (nameMatch) inquiry.name = nameMatch[1].trim();

      // 전화번호 추출
      const phoneMatch = text.match(/(?:전화번호|연락처|휴대폰)[:\s]*([\d-]+)/i);
      if (phoneMatch) inquiry.phone = phoneMatch[1].trim();

      // 이메일 추출
      const emailMatch = text.match(/(?:이메일|email)[:\s]*([^\s\n]+@[^\s\n]+)/i);
      if (emailMatch) inquiry.email = emailMatch[1].trim();

      // 주소 추출
      const addressMatch = text.match(/(?:주소|위치)[:\s]*([^\n]+)/i);
      if (addressMatch) inquiry.address = addressMatch[1].trim();

      // 공사 종류 추출
      const projectTypeMatch = text.match(/(?:공사\s*종류|프로젝트\s*유형)[:\s]*([^\n]+)/i);
      if (projectTypeMatch) inquiry.projectType = projectTypeMatch[1].trim();

      // 예산 추출
      const budgetMatch = text.match(/(?:예산|비용)[:\s]*([^\n]+)/i);
      if (budgetMatch) inquiry.budget = budgetMatch[1].trim();

      // 문의내용 추출
      const messageMatch = text.match(/(?:문의\s*내용|내용)[:\s]*([^\n]+(?:\n(?!(?:이름|전화|이메일|주소|예산)).+)*)/i);
      if (messageMatch) {
        inquiry.message = messageMatch[1].trim();
      } else {
        // 문의내용 레이블이 없으면 전체 텍스트를 메시지로 사용
        inquiry.message = text.slice(0, 500);
      }

      // 필수 정보 확인
      if (!inquiry.name && !inquiry.phone && !inquiry.email) {
        console.warn('⚠️ 필수 정보를 찾을 수 없는 이메일:', parsed.subject);
        // 기본값 설정
        inquiry.name = '이름 없음';
        inquiry.phone = '전화번호 없음';
        inquiry.email = parsed.from?.value?.[0]?.address || 'hv_lab@naver.com';
        inquiry.message = text.slice(0, 500);
      }

      return inquiry;
    } catch (error) {
      console.error('❌ 이메일 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 견적문의 데이터베이스 저장
   */
  async saveQuoteInquiry(inquiry) {
    return new Promise((resolve, reject) => {
      // 중복 체크 (같은 이름, 전화번호, 이메일이 최근 24시간 이내에 있는지)
      db.get(
        `SELECT id FROM quote_inquiries
         WHERE name = ? AND phone = ? AND email = ?
         AND created_at > datetime('now', '-1 day')
         LIMIT 1`,
        [inquiry.name, inquiry.phone, inquiry.email],
        (err, existing) => {
          if (err) {
            reject(err);
            return;
          }

          if (existing) {
            console.log('⚠️ 중복된 견적문의 (24시간 이내):', inquiry.name);
            resolve(existing.id);
            return;
          }

          // 새로운 견적문의 저장
          db.run(
            `INSERT INTO quote_inquiries
             (name, phone, email, address, project_type, budget, message, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              inquiry.name,
              inquiry.phone,
              inquiry.email,
              inquiry.address || '',
              inquiry.projectType || '',
              inquiry.budget || '',
              inquiry.message,
            ],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        }
      );
    });
  }

  /**
   * 연결 정리
   */
  cleanup() {
    this.isChecking = false;
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }
}

module.exports = new EmailService();
