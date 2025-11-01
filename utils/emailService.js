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

      const inquiry = {
        name: '',
        phone: '',
        email: '',
        address: '',
        projectType: '',
        budget: '',
        message: '',
        sashWork: '',
        extensionWork: '',
        preferredDate: '',
        areaSize: '',
        attachments: [],
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
      const emailMatch = text.match(/(?:이메일|E-mail)\s*주소[:\s]*([^\s\n]+@[^\s\n]+)/i);
      if (emailMatch) inquiry.email = emailMatch[1].trim();

      // 주소 추출 - "면적 주소" 형식
      const addressMatch = text.match(/면적\s*주소[:\s]*([^\n]+)/i);
      if (addressMatch) inquiry.address = addressMatch[1].trim();

      // 건물분류 추출
      const projectTypeMatch = text.match(/건물분류\s*\(문화\)[:\s]*([^\n]+)/i);
      if (projectTypeMatch) inquiry.projectType = projectTypeMatch[1].trim();

      // 예산 추출 - "경사 제거" 항목에서 추출
      const budgetMatch = text.match(/경사\s*제거[:\s]*([^\n]+)/i);
      if (budgetMatch) inquiry.budget = budgetMatch[1].trim();

      // 평수 추출 - "면적 (평형 / 타입)"
      const areaSizeMatch = text.match(/면적\s*\(평형\s*\/\s*타입\)[:\s]*([^\n]+)/i);
      if (areaSizeMatch) inquiry.areaSize = areaSizeMatch[1].trim();

      // 첨부파일 처리
      if (parsed.attachments && parsed.attachments.length > 0) {
        inquiry.attachments = parsed.attachments
          .filter(att => att.contentType && att.contentType.startsWith('image/'))
          .map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content: att.content ? att.content.toString('base64') : null
          }));
      }

      // 메일 전체 내용을 message에 저장 (모든 정보 보존)
      // "분야" 섹션 이후의 모든 내용을 추출
      const mainContentMatch = text.match(/분야[\s\S]*/i);
      if (mainContentMatch) {
        inquiry.message = mainContentMatch[0].trim();
      } else {
        // 분야가 없으면 전체 텍스트 사용
        inquiry.message = text.trim();
      }

      // 필수 정보 확인
      if (!inquiry.name && !inquiry.phone && !inquiry.email) {
        console.warn('⚠️ 필수 정보를 찾을 수 없는 이메일:', parsed.subject);
        // 기본값 설정
        inquiry.name = '이름 없음';
        inquiry.phone = '전화번호 없음';
        inquiry.email = parsed.from?.value?.[0]?.address || 'hv_lab@naver.com';
        inquiry.message = text.trim();
      }

      console.log('📋 파싱된 견적문의:', {
        name: inquiry.name,
        phone: inquiry.phone,
        email: inquiry.email,
        messageLength: inquiry.message.length
      });

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

          // 첨부파일 JSON으로 변환
          const attachmentsJson = inquiry.attachments && inquiry.attachments.length > 0
            ? JSON.stringify(inquiry.attachments)
            : null;

          // 새로운 견적문의 저장
          db.run(
            `INSERT INTO quote_inquiries
             (name, phone, email, address, project_type, budget, message, is_read,
              sash_work, extension_work, preferred_date, area_size, attachments)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
            [
              inquiry.name,
              inquiry.phone,
              inquiry.email,
              inquiry.address || '',
              inquiry.projectType || '',
              inquiry.budget || '',
              inquiry.message,
              inquiry.sashWork || '',
              inquiry.extensionWork || '',
              inquiry.preferredDate || '',
              inquiry.areaSize || '',
              attachmentsJson
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
