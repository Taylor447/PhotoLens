import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';

const permittedOrigin = 'https://photolens.example.com';
const makeImage = () => Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]).toString('base64');
const photoAnalysis = () => ({
  the_loai: 'Phong cảnh',
  chu_the: 'Ngọn núi dưới bầu trời nhiều mây',
  dac_diem: ['Đường chân trời nằm ở 1/3 phía trên'],
  bo_cuc: { nhan_xet: 'Đường chân trời rõ và cân bằng.', diem: 78 },
  anh_sang: { nhan_xet: 'Vùng mây sáng nhưng vẫn còn chi tiết.', diem: 72 },
  mau_sac: { nhan_xet: 'Tông xanh dịu, khá đồng nhất.', diem: 75 },
  ky_thuat: { nhan_xet: 'Các đường núi nhìn rõ.', diem: 80 },
  cam_xuc_sang_tao: { nhan_xet: 'Khung hình tạo cảm giác yên tĩnh.', diem: 74 },
  diem_manh: ['Lớp núi tạo chiều sâu cho ảnh.'],
  diem_yeu: ['Khoảng trời chiếm hơi nhiều diện tích.'],
  goi_y_khi_chup: ['Hạ góc máy nhẹ để đưa tiền cảnh vào khung.'],
  goi_y_chinh_sua: ['Cắt bớt khoảng trời khoảng 10% và giảm highlight nhẹ.']
});
const compareResult = () => ({
  analyses: { A: photoAnalysis(), B: photoAnalysis() },
  comparison: {
    criteria: Object.fromEntries(['bo_cuc', 'anh_sang', 'mau_sac', 'ky_thuat', 'cam_xuc_sang_tao'].map(key => [key, { winner: 'A', reason: 'Ảnh A giữ được chi tiết sáng tốt hơn.' } ])),
    best_for: Object.fromEntries(['social', 'print', 'portfolio'].map(key => [key, { image: 'A', reason: 'Ảnh A có bố cục cân đối hơn.' } ])),
    conclusion: 'Ảnh A nhỉnh hơn về ánh sáng và bố cục.',
    weaker_image_tips: ['Ảnh B có thể giảm phơi sáng nhẹ để giữ chi tiết mây.']
  }
});
const env = {
  ALLOWED_ORIGINS: `http://localhost:5173,https://localhost,capacitor://localhost,photolens://app,${permittedOrigin}`,
  GEMINI_MODEL: 'gemini-test-model',
  GEMINI_API_KEY: 'unit-test-secret',
  PHOTO_AI_LIMITER: { async limit() { return { success: true }; } }
};
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; });

function request(path, { method = 'POST', origin = permittedOrigin, body, headers = {} } = {}) {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function geminiResponse(value) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });
}

describe('PhotoLens Worker AI contract', () => {
  it('health trả model đang cấu hình và chỉ cho origin được phép', async () => {
    const response = await worker.fetch(request('/health', { method: 'GET' }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, model: 'gemini-test-model' });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), permittedOrigin);
  });

  it('phân tích ảnh JPEG hợp lệ bằng Gemini với schema JSON', async () => {
    let called = false;
    globalThis.fetch = async (url, options) => {
      called = true;
      assert.match(String(url), /gemini-test-model:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'unit-test-secret');
      const sent = JSON.parse(options.body);
      assert.equal(sent.generationConfig.responseMimeType, 'application/json');
      assert.ok(sent.generationConfig.responseSchema.properties.analysis);
      assert.equal(sent.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
      return geminiResponse({ analysis: photoAnalysis() });
    };

    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).analysis.the_loai, 'Phong cảnh');
    assert.equal(called, true);
  });

  it('từ chối ảnh vượt 1,5 MB bằng HTTP 413', async () => {
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: ['A'.repeat(1_500_004)] } }), env);
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'IMAGE_TOO_LARGE');
  });

  it('từ chối origin không nằm trong allowlist', async () => {
    globalThis.fetch = async () => { throw new Error('Không được gọi Gemini khi origin bị chặn.'); };
    const response = await worker.fetch(request('/analyze', { origin: 'https://evil.example', body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED');
    const originless = await worker.fetch(request('/health', { method: 'GET', origin: null }), env);
    assert.equal(originless.status, 403);
  });

  it('che lỗi khóa Gemini sai bằng thông báo tiếng Việt', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'invalid secret unit-test-secret' } }), { status: 403 });
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, 'GEMINI_AUTH');
    assert.match(body.error.message, /kiểm tra secret/);
    assert.equal(body.error.message.includes('unit-test-secret'), false);
  });

  it('báo lỗi mềm khi mất mạng tới Gemini', async () => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'GEMINI_UNAVAILABLE');
  });

  it('trả lỗi timeout có cấu trúc nếu Gemini quá thời hạn 30 giây', async () => {
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 504);
    assert.equal((await response.json()).error.code, 'GEMINI_TIMEOUT');
  });

  it('thử lại JSON sai một lần và chấp nhận kết quả đúng schema', async () => {
    let attempts = 0;
    globalThis.fetch = async () => ++attempts === 1 ? geminiResponse({ unexpected: true }) : geminiResponse({ analysis: photoAnalysis() });
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 200);
    assert.equal(attempts, 2);
  });

  it('dừng sau tối đa hai lần thử lại khi Gemini luôn trả JSON sai schema', async () => {
    let attempts = 0;
    globalThis.fetch = async () => { attempts += 1; return geminiResponse({ unexpected: true }); };
    const response = await worker.fetch(request('/analyze', { body: { mode: 'single', images: [makeImage()] } }), env);
    assert.equal(response.status, 502);
    assert.equal(attempts, 3);
    assert.equal((await response.json()).error.code, 'INVALID_GEMINI_SCHEMA');
  });

  it('trả schema so sánh đủ hai ảnh và các mục đích sử dụng', async () => {
    globalThis.fetch = async (_url, options) => {
      const sent = JSON.parse(options.body);
      assert.ok(sent.generationConfig.responseSchema.properties.comparison);
      return geminiResponse(compareResult());
    };
    const response = await worker.fetch(request('/analyze', { body: { mode: 'compare', images: [makeImage(), makeImage()] } }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.analyses.A && body.analyses.B);
    assert.equal(body.comparison.best_for.portfolio.image, 'A');
  });
});
