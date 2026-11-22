const MAX_IMAGE_BASE64_BYTES = 1_500_000;
const MAX_REQUEST_BYTES = 3_100_000;
const MAX_IMAGES = 2;
const GEMINI_TIMEOUT_MS = 30_000;
const MAX_SCHEMA_ATTEMPTS = 3; // Một lần thử ban đầu và tối đa hai lần thử lại.

const DIMENSIONS = ['bo_cuc', 'anh_sang', 'mau_sac', 'ky_thuat', 'cam_xuc_sang_tao'];

const SCORE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nhan_xet: { type: 'STRING' },
    diem: { type: 'INTEGER', minimum: 0, maximum: 100 }
  },
  required: ['nhan_xet', 'diem']
};

const PHOTO_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    the_loai: { type: 'STRING' },
    chu_the: { type: 'STRING' },
    dac_diem: { type: 'ARRAY', items: { type: 'STRING' } },
    bo_cuc: SCORE_SCHEMA,
    anh_sang: SCORE_SCHEMA,
    mau_sac: SCORE_SCHEMA,
    ky_thuat: SCORE_SCHEMA,
    cam_xuc_sang_tao: SCORE_SCHEMA,
    diem_manh: { type: 'ARRAY', items: { type: 'STRING' } },
    diem_yeu: { type: 'ARRAY', items: { type: 'STRING' } },
    goi_y_khi_chup: { type: 'ARRAY', items: { type: 'STRING' } },
    goi_y_chinh_sua: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: [
    'the_loai', 'chu_the', 'dac_diem', 'bo_cuc', 'anh_sang', 'mau_sac',
    'ky_thuat', 'cam_xuc_sang_tao', 'diem_manh', 'diem_yeu',
    'goi_y_khi_chup', 'goi_y_chinh_sua'
  ]
};

const COMPARISON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    analyses: {
      type: 'OBJECT',
      properties: { A: PHOTO_ANALYSIS_SCHEMA, B: PHOTO_ANALYSIS_SCHEMA },
      required: ['A', 'B']
    },
    comparison: {
      type: 'OBJECT',
      properties: {
        criteria: {
          type: 'OBJECT',
          properties: Object.fromEntries(DIMENSIONS.map(key => [key, {
            type: 'OBJECT',
            properties: {
              winner: { type: 'STRING', enum: ['A', 'B', 'tie'] },
              reason: { type: 'STRING' }
            },
            required: ['winner', 'reason']
          }])),
          required: DIMENSIONS
        },
        best_for: {
          type: 'OBJECT',
          properties: Object.fromEntries(['social', 'print', 'portfolio'].map(key => [key, {
            type: 'OBJECT',
            properties: {
              image: { type: 'STRING', enum: ['A', 'B'] },
              reason: { type: 'STRING' }
            },
            required: ['image', 'reason']
          }])),
          required: ['social', 'print', 'portfolio']
        },
        conclusion: { type: 'STRING' },
        weaker_image_tips: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['criteria', 'best_for', 'conclusion', 'weaker_image_tips']
    }
  },
  required: ['analyses', 'comparison']
};

const WATERMARK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    watermarks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          brand: { type: 'STRING' },
          mark_type: { type: 'STRING', enum: ['text', 'logo', 'symbol', 'combined', 'unknown'] },
          location: { type: 'STRING', enum: ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right', 'unknown'] },
          confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
          evidence: { type: 'STRING' }
        },
        required: ['brand', 'mark_type', 'location', 'confidence', 'evidence']
      }
    }
  },
  required: ['watermarks']
};

const SYSTEM_PROMPT = `Bạn là chuyên gia nhiếp ảnh và biên tập ảnh. Hãy nhận xét khách quan, cụ thể, chỉ dựa trên những gì nhìn thấy trong ảnh. Không suy đoán hoặc bịa thông tin EXIF, thiết bị, địa điểm hay bối cảnh không thể xác định từ ảnh. Chấm điểm số nguyên 0–100 theo cùng một thang cố định cho bố cục, ánh sáng, màu sắc, kỹ thuật và cảm xúc/sáng tạo; 50 là mức trung bình, 70 là tốt, 90 là xuất sắc, điểm thấp phải chỉ rõ vấn đề. Mỗi điểm mạnh, điểm yếu và gợi ý phải cụ thể, có thể thực hiện, nói rõ cách chụp hoặc chỉnh sửa; mỗi mục tối đa 1–2 câu. Chỉ trả JSON đúng response schema, không thêm Markdown hay chữ ngoài JSON.`;

function errorBody(code, message) {
  return { error: { code, message } };
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && allowedOrigins(env).includes(origin));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin && allowedOrigins(env).includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function failure(request, env, code, message, status) {
  return json(request, env, errorBody(code, message), status);
}

async function readJsonLimited(request) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw Object.assign(new Error('Yêu cầu vượt quá giới hạn 3,1 MB.'), { code: 'REQUEST_TOO_LARGE', status: 413 });
  }
  if (!request.body) {
    throw Object.assign(new Error('Thiếu nội dung yêu cầu.'), { code: 'INVALID_JSON', status: 400 });
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw Object.assign(new Error('Yêu cầu vượt quá giới hạn 3,1 MB.'), { code: 'REQUEST_TOO_LARGE', status: 413 });
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw Object.assign(new Error('Nội dung JSON không hợp lệ.'), { code: 'INVALID_JSON', status: 400 });
  }
}

function isBase64Jpeg(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length > MAX_IMAGE_BASE64_BYTES) {
    throw Object.assign(new Error('Mỗi ảnh không được vượt quá 1,5 MB sau mã hóa.'), { code: 'IMAGE_TOO_LARGE', status: 413 });
  }
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  try {
    const prefix = atob(value.slice(0, 8));
    return prefix.length >= 3 && prefix.charCodeAt(0) === 0xff && prefix.charCodeAt(1) === 0xd8 && prefix.charCodeAt(2) === 0xff;
  } catch {
    return false;
  }
}

function validText(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 1200;
}

function hasExactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}

function validAnalysis(value) {
  const analysisKeys = [
    'the_loai', 'chu_the', 'dac_diem', ...DIMENSIONS,
    'diem_manh', 'diem_yeu', 'goi_y_khi_chup', 'goi_y_chinh_sua'
  ];
  if (!hasExactKeys(value, analysisKeys)) return false;
  if (!validText(value.the_loai) || !validText(value.chu_the)) return false;
  if (!Array.isArray(value.dac_diem) || value.dac_diem.length > 20 || !value.dac_diem.every(validText)) return false;
  for (const key of DIMENSIONS) {
    const item = value[key];
    if (!hasExactKeys(item, ['nhan_xet', 'diem']) || !validText(item.nhan_xet) || !Number.isInteger(item.diem) || item.diem < 0 || item.diem > 100) return false;
  }
  for (const key of ['diem_manh', 'diem_yeu', 'goi_y_khi_chup', 'goi_y_chinh_sua']) {
    if (!Array.isArray(value[key]) || value[key].length > 20 || !value[key].every(validText)) return false;
  }
  return true;
}

function validComparison(value) {
  if (!hasExactKeys(value, ['analyses', 'comparison']) ||
    !hasExactKeys(value.analyses, ['A', 'B']) ||
    !hasExactKeys(value.comparison, ['criteria', 'best_for', 'conclusion', 'weaker_image_tips'])) return false;
  if (!validAnalysis(value.analyses.A) || !validAnalysis(value.analyses.B)) return false;
  const comparison = value.comparison;
  if (!validText(comparison.conclusion)) return false;
  if (!Array.isArray(comparison.weaker_image_tips) || comparison.weaker_image_tips.length > 20 || !comparison.weaker_image_tips.every(validText)) return false;
  if (!hasExactKeys(comparison.criteria, DIMENSIONS) || !hasExactKeys(comparison.best_for, ['social', 'print', 'portfolio'])) return false;
  for (const key of DIMENSIONS) {
    const item = comparison.criteria?.[key];
    if (!hasExactKeys(item, ['winner', 'reason']) || !['A', 'B', 'tie'].includes(item.winner) || !validText(item.reason)) return false;
  }
  for (const key of ['social', 'print', 'portfolio']) {
    const item = comparison.best_for?.[key];
    if (!hasExactKeys(item, ['image', 'reason']) || !['A', 'B'].includes(item.image) || !validText(item.reason)) return false;
  }
  return true;
}

function validWatermarks(value) {
  if (!hasExactKeys(value, ['watermarks']) || !Array.isArray(value.watermarks) || value.watermarks.length > 20) return false;
  const types = ['text', 'logo', 'symbol', 'combined', 'unknown'];
  const locations = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right', 'unknown'];
  return value.watermarks.every(mark =>
    hasExactKeys(mark, ['brand', 'mark_type', 'location', 'confidence', 'evidence']) &&
    validText(mark.brand) && types.includes(mark.mark_type) && locations.includes(mark.location) &&
    typeof mark.confidence === 'number' && mark.confidence >= 0 && mark.confidence <= 1 &&
    validText(mark.evidence)
  );
}

function validatePayload(body) {
  if (!body || !['single', 'compare', 'watermarks'].includes(body.mode)) {
    return { error: ['INVALID_MODE', 'Chế độ phải là single, compare hoặc watermarks.'] };
  }
  const expectedCount = body.mode === 'compare' ? 2 : 1;
  if (!Array.isArray(body.images) || body.images.length !== expectedCount || body.images.length > MAX_IMAGES) {
    return { error: ['INVALID_IMAGES', body.mode === 'compare' ? 'Chế độ so sánh cần đúng 2 ảnh JPEG A và B.' : 'Chế độ này cần đúng 1 ảnh JPEG.'] };
  }
  for (const image of body.images) {
    try {
      if (!isBase64Jpeg(image)) return { error: ['INVALID_IMAGE', 'Ảnh gửi lên phải là JPEG base64 hợp lệ.'] };
    } catch (error) {
      return { error: [error.code, error.message], status: error.status };
    }
  }
  return { images: body.images };
}

function promptForMode(mode) {
  if (mode === 'watermarks') return 'Nhận diện dấu chìm, logo hoặc tên hãng nhìn thấy rõ trong ảnh. Chỉ đưa kết quả có bằng chứng trực quan; không suy đoán từ nội dung cảnh vật hoặc thương hiệu máy ảnh. Nếu không chắc, trả mảng rỗng. Với mỗi dấu, ghi hãng nếu đọc được, loại dấu, vị trí gần đúng theo lưới 3x3, độ tin cậy 0 đến 1 và mô tả ngắn bằng tiếng Việt về bằng chứng.';
  if (mode === 'single') {
    return 'Phân tích ảnh duy nhất được gửi. Trả về object có khóa analysis chứa đầy đủ trường theo schema.';
  }
  return 'Có hai ảnh theo đúng thứ tự: ảnh A trước, ảnh B sau. Phân tích riêng từng ảnh trong analyses.A và analyses.B. Trong comparison.criteria, với từng tiêu chí hãy chọn winner là A, B hoặc tie và nêu lý do nhìn thấy được. Trong best_for, hãy chọn ảnh phù hợp nhất cho social (mạng xã hội), print (in ấn), portfolio (portfolio) và giải thích dựa trên ảnh. conclusion nêu kết luận cụ thể; weaker_image_tips nêu cách giúp ảnh yếu hơn cải thiện.';
}

async function checkRateLimit(request, env) {
  if (!env.PHOTO_AI_LIMITER) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const result = await env.PHOTO_AI_LIMITER.limit({ key: ip });
  return Boolean(result?.success);
}

async function readGeminiText(response) {
  const result = await response.json().catch(() => null);
  return result?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || '';
}

async function analyzeWithGemini({ mode, images, env }) {
  const model = String(env.GEMINI_MODEL || '').trim();
  if (!model) return { error: ['MODEL_NOT_CONFIGURED', 'Worker chưa có biến GEMINI_MODEL trong wrangler.toml.'], status: 503 };
  if (!env.GEMINI_API_KEY) return { error: ['KEY_NOT_CONFIGURED', 'Worker chưa được cấu hình secret GEMINI_API_KEY.'], status: 503 };

  const schema = mode === 'watermarks' ? WATERMARK_SCHEMA : mode === 'single'
    ? { type: 'OBJECT', properties: { analysis: PHOTO_ANALYSIS_SCHEMA }, required: ['analysis'] }
    : COMPARISON_SCHEMA;
  const parts = [{ text: promptForMode(mode) }];
  for (const data of images) parts.push({ inlineData: { mimeType: 'image/jpeg', data } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let lastSchemaError = false;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new DOMException('Gemini timed out', 'TimeoutError')), GEMINI_TIMEOUT_MS);

  try {
  for (let attempt = 0; attempt < MAX_SCHEMA_ATTEMPTS; attempt++) {
    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.25,
            maxOutputTokens: mode === 'compare' ? 6000 : mode === 'watermarks' ? 1800 : 3000
          }
        }),
        signal: timeoutController.signal
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return { error: [timedOut ? 'GEMINI_TIMEOUT' : 'GEMINI_UNAVAILABLE', timedOut ? 'Gemini phản hồi quá 30 giây. Hãy thử lại sau.' : 'Không kết nối được tới Gemini. Hãy kiểm tra mạng rồi thử lại.'], status: timedOut ? 504 : 502 };
    }

    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        return { error: ['GEMINI_AUTH', 'Gemini từ chối khóa API. Hãy kiểm tra secret GEMINI_API_KEY trong Worker.'], status: 502 };
      }
      if (upstream.status === 429) return { error: ['GEMINI_RATE_LIMIT', 'Gemini đang giới hạn yêu cầu. Hãy đợi một chút rồi thử lại.'], status: 429 };
      // Chỉ trả trạng thái và thông báo lỗi của Gemini đã rút gọn; tuyệt đối không log ảnh hay khóa API.
      const upstreamError = await upstream.json().catch(() => null);
      let detail = typeof upstreamError?.error?.message === 'string'
        ? upstreamError.error.message.replace(/\s+/g, ' ').trim().slice(0, 240)
        : '';
      if (detail && env.GEMINI_API_KEY) detail = detail.split(env.GEMINI_API_KEY).join('[đã ẩn khóa]');
      const providerStatus = typeof upstreamError?.error?.status === 'string' ? ` (${upstreamError.error.status})` : '';
      const diagnostic = detail ? `: ${detail}` : '.';
      return {
        error: ['GEMINI_ERROR', `Gemini trả HTTP ${upstream.status}${providerStatus}${diagnostic}`],
        status: 502
      };
    }

    const responseText = await readGeminiText(upstream);
    if (timeoutController.signal.aborted) {
      return { error: ['GEMINI_TIMEOUT', 'Gemini phản hồi quá 30 giây. Hãy thử lại sau.'], status: 504 };
    }
    try {
      if (!responseText) throw new Error('Gemini không trả về nội dung JSON.');
      const parsed = JSON.parse(responseText);
      const valid = mode === 'single'
        ? Boolean(parsed && validAnalysis(parsed.analysis))
        : mode === 'watermarks' ? validWatermarks(parsed) : validComparison(parsed);
      if (!valid) throw new Error('JSON không khớp schema PhotoLens.');
      return { data: parsed };
    } catch {
      lastSchemaError = true;
    }
  }

  if (lastSchemaError) {
    return { error: ['INVALID_GEMINI_SCHEMA', 'Gemini đã trả về dữ liệu sai cấu trúc sau 2 lần thử lại. Chỉ số cục bộ vẫn dùng được.'], status: 502 };
  }
  return { error: ['GEMINI_ERROR', 'Không nhận được kết quả phân tích hợp lệ từ Gemini.'], status: 502 };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  async fetch(request, env = {}) {
    if (!isAllowedOrigin(request, env)) {
      return failure(request, env, 'ORIGIN_NOT_ALLOWED', 'Ứng dụng này không được phép kết nối tới PhotoLens Worker.', 403);
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, env, { ok: true, model: String(env.GEMINI_MODEL || '') });
    }
    if (request.method === 'GET' && url.pathname !== '/health') {
      return failure(request, env, 'NOT_FOUND', 'Không tìm thấy đường dẫn này.', 404);
    }
    if (request.method !== 'POST') {
      return failure(request, env, 'METHOD_NOT_ALLOWED', 'Hãy dùng POST để phân tích ảnh.', 405);
    }
    if (url.pathname !== '/analyze') {
      return failure(request, env, 'NOT_FOUND', 'Không tìm thấy đường dẫn này.', 404);
    }

    let allowed;
    try {
      allowed = await checkRateLimit(request, env);
    } catch {
      return failure(request, env, 'RATE_LIMIT_UNAVAILABLE', 'Không kiểm tra được giới hạn yêu cầu. Hãy thử lại sau.', 503);
    }
    if (allowed === null) {
      return failure(request, env, 'RATE_LIMIT_UNAVAILABLE', 'Worker chưa được cấu hình giới hạn tần suất.', 503);
    }
    if (!allowed) {
      return failure(request, env, 'RATE_LIMITED', 'Bạn đã dùng hết 20 lượt phân tích trong một phút. Hãy chờ rồi thử lại.', 429);
    }

    let body;
    try {
      body = await readJsonLimited(request);
    } catch (error) {
      return failure(request, env, error.code || 'INVALID_JSON', error.message || 'Yêu cầu không hợp lệ.', error.status || 400);
    }
    const payload = validatePayload(body);
    if (payload.error) {
      return failure(request, env, payload.error[0], payload.error[1], payload.status || 400);
    }

    const result = await analyzeWithGemini({ mode: body.mode, images: payload.images, env });
    if (result.error) return failure(request, env, result.error[0], result.error[1], result.status || 502);
    return json(request, env, result.data);
  }
};
