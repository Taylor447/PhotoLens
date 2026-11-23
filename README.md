# PhotoLens

PhotoLens là ứng dụng tiếng Việt để phân tích một ảnh hoặc so sánh hai ảnh. Các chỉ số kỹ thuật được đo trên thiết bị bằng Canvas 2D và Web Worker. Gemini là tùy chọn, chỉ nhận ảnh JPEG đã thu nhỏ qua Cloudflare Worker.

## Nền tảng và quyền riêng tư

- Web/PWA: cài từ trình duyệt và dùng phần đo cục bộ khi ngoại tuyến sau lần tải đầu.
- Android: Capacitor, chọn ảnh bằng Photo Picker, chụp qua Camera plugin.
- Windows: Electron, menu ứng dụng, kéo thả, `Ctrl+O` mở ảnh và `Ctrl+S` xuất báo cáo.
- Dự án không còn cấu hình iOS hoặc macOS.
- Ảnh gốc không được gửi tới AI. Khi bật AI, Canvas tạo JPEG mới với cạnh dài tối đa 1024 px, qua đó loại bỏ EXIF/GPS trước khi gửi.
- API key Gemini chỉ được lưu trong Cloudflare Worker secret. Không đặt key trong `.env`, mã frontend hoặc `dist/`.
- Lịch sử lưu trên thiết bị; không lưu ảnh gốc vào lịch sử.

## Yêu cầu

- Node.js 22.12 trở lên và npm.
- Windows: PowerShell hoặc Command Prompt.
- Android: Android Studio và Android SDK nếu muốn build APK/AAB.
- Kiểm thử E2E: Chromium do Playwright cài đặt.

## Cài và chạy web

Trong PowerShell, dùng `npm.cmd` và `npx.cmd` để tránh Execution Policy chặn `npm.ps1`/`npx.ps1`:

```powershell
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite in ra trong terminal. Lệnh build và xem bản build:

```powershell
npm.cmd run build
npm.cmd run preview
```

Nếu Windows báo `running scripts is disabled`, không cần đổi Execution Policy: chạy lệnh tương đương bằng `npm.cmd`/`npx.cmd`.

## Cấu hình AI và Cloudflare Worker

1. Tạo Gemini API key trong [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Tạo `.env.local` từ `.env.example` bằng `Copy-Item .env.example .env.local`; điền URL Worker đã deploy vào `VITE_AI_ENDPOINT`. Đây chỉ là URL công khai của Worker, không phải khóa API.
3. Khi chạy Worker local, sao chép `worker/.dev.vars.example` thành `worker/.dev.vars` và điền `GEMINI_API_KEY`.
4. Đăng nhập Cloudflare, sau đó lưu khóa production trực tiếp dưới dạng secret:

   ```powershell
   npx.cmd wrangler login
   npx.cmd wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
   ```

5. Trong `worker/wrangler.toml`, sửa `ALLOWED_ORIGINS` thành đúng các origin cần dùng. Ví dụ: `https://ten-mien-cua-ban.vn,https://localhost,photolens://app,http://localhost:5173`.
6. Chạy Worker local hoặc deploy:

   ```powershell
   npm.cmd run worker:dev
   npm.cmd run worker:deploy
   ```

7. Nếu không dùng biến `VITE_AI_ENDPOINT`, mở PhotoLens → **Cấu hình AI** và nhập URL Worker. AI có thể không khả dụng khi ngoại tuyến; báo cáo chỉ số cục bộ vẫn hoạt động.

Không commit `.env.local`, `worker/.dev.vars` hoặc keystore. CORS chỉ giới hạn origin trình duyệt; rate limit của Worker là lớp bảo vệ bổ sung, không thay cho việc bảo vệ secret.

## Lệnh npm

| Lệnh | Tác dụng |
| --- | --- |
| `npm.cmd run dev` | Chạy Vite dev server |
| `npm.cmd run build` | Build web/PWA vào `dist/` |
| `npm.cmd run preview` | Xem bản build bằng Vite preview |
| `npm.cmd run test:unit` | Chạy unit test `/core` bằng Vitest |
| `npm.cmd run test:e2e:install` | Cài Chromium cho Playwright lần đầu |
| `npm.cmd run test:e2e` | Chạy E2E: phân tích, so sánh, xuất JSON và responsive |
| `npm.cmd test` | Chạy unit test rồi E2E |
| `npm.cmd run worker:dev` | Chạy Cloudflare Worker local |
| `npm.cmd run worker:deploy` | Deploy Worker |
| `npm.cmd run cap:android` | Build web, sync Android, cập nhật tài nguyên và mở Android Studio |
| `npm.cmd run cap:sync` | Build web và đồng bộ mã vào Android |
| `npm.cmd run electron:dev` | Build web rồi mở ứng dụng Electron |
| `npm.cmd run electron:build` | Đóng gói bộ cài Windows `.exe` |

## Kiểm thử và ảnh mẫu

Unit test trong `core/metrics.test.js` kiểm tra độ sáng, tương phản/độ nét, nhiễu, bảng màu, điểm số và ảnh bằng nhau. Bộ ảnh trong `tests/fixtures/` gồm ảnh sáng, tối, nét, mờ, nhiễu và bảng màu. Playwright kiểm tra ba luồng chính và không tràn ngang ở 360, 768, 1280, 1920 px.

Chạy lần đầu:

```powershell
npm.cmd run test:e2e:install
npm.cmd test
```

Nếu máy không tải được Chromium, `test:unit` vẫn chạy độc lập; cài Chromium rồi chạy `test:e2e` sau đó.

## PWA và ngoại tuyến

`npm.cmd run build` đưa manifest, biểu tượng và service worker vào `dist/`. Khi host trên HTTPS (hoặc localhost), mở ứng dụng và chọn **Cài đặt ứng dụng** trong trình duyệt. Service worker lưu app shell để mở lại ngoại tuyến; Gemini cần kết nối mạng.

## Android: tạo APK/AAB

1. Cài Android Studio, Android SDK và cấu hình biến `ANDROID_HOME` nếu máy yêu cầu.
2. Cài dependency và tạo project native Android một lần:

   ```powershell
   npm.cmd install
   npx.cmd cap add android
   ```

3. Đồng bộ build web, plugin, quyền camera, icon và splash rồi mở Android Studio:

   ```powershell
   npm.cmd run cap:android
   ```

4. Trong Android Studio chờ **Gradle Sync** hoàn tất. Chạy thử trên thiết bị/emulator bằng nút **Run**.
5. Tạo APK thử nghiệm: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Android Studio hiển thị đường dẫn APK khi hoàn tất.
6. Tạo bản phát hành có ký: **Build → Generate Signed Bundle / APK** → chọn **Android App Bundle** để phát hành qua Play Console hoặc **APK** để cài trực tiếp.
7. Nếu chưa có khóa ký, tạo keystore trên máy cá nhân ở ngoài thư mục dự án. Ví dụ:

   ```powershell
   keytool -genkeypair -v -keystore "$env:USERPROFILE\photolens-release.jks" -alias photolens -keyalg RSA -keysize 2048 -validity 10000
   ```

   Giữ mật khẩu và bản sao lưu riêng tư. Mất keystore có thể khiến bạn không cập nhật được bản Android đã phát hành. Không đưa `.jks`/`.keystore` lên Git.
8. Mỗi lần đổi mã web, chạy `npm.cmd run cap:sync`, sau đó build lại trong Android Studio.

Ứng dụng chỉ yêu cầu quyền camera khi chụp. Chọn ảnh dùng bộ chọn hệ thống Android; app không yêu cầu quyền đọc toàn bộ thư viện ảnh.

## Windows: chạy và đóng gói `.exe`

```powershell
npm.cmd install
npm.cmd run electron:dev
npm.cmd run electron:build
```

Bộ cài NSIS được tạo trong `release/`. Electron dùng origin nội bộ `photolens://app`, CSP, preload giới hạn IPC và chặn điều hướng ra ngoài. Gói build mặc định chưa ký chứng thư nhà phát hành; Windows có thể hiện cảnh báo SmartScreen khi cài.

## Checklist thủ công

### Android

- [ ] Cài APK debug và bản ký trên thiết bị thật.
- [ ] Chọn ảnh từ thư viện, chụp ảnh; từ chối quyền camera và kiểm tra thông báo hướng dẫn.
- [ ] Kiểm tra nút Back khi đang ở modal, chế độ so sánh và màn chính.
- [ ] Thử ảnh nhỏ, ảnh >20 MB, sai định dạng, PNG trong suốt, HEIC và ảnh có EXIF xoay.
- [ ] Bật chế độ máy bay: chỉ số cục bộ vẫn chạy, AI báo chưa khả dụng.
- [ ] Kiểm tra safe-area, bottom bar, nút chạm và xoay màn hình.
- [ ] Xuất/chia sẻ báo cáo và xóa lịch sử.

### Windows

- [ ] Cài và mở `.exe`; kéo thả ảnh, dùng `Ctrl+O`, `Ctrl+S` và menu ứng dụng.
- [ ] Kiểm tra cửa sổ không nhỏ hơn kích thước tối thiểu và resize ở các độ rộng 360/768/1280/1920 px.
- [ ] Thử phân tích đơn, so sánh hai ảnh, ảnh sai định dạng/ảnh lớn và chế độ offline.
- [ ] Xuất PDF/PNG/JSON, mở file xuất và xóa lịch sử.
- [ ] Xác nhận Worker chỉ cho phép đúng origin đã khai báo.

## Cấu trúc chính

```text
core/                  Thuật toán chỉ số và config trọng số, không phụ thuộc giao diện
js/main.js             Giao diện, nhập ảnh, AI, lịch sử và xuất báo cáo
js/analysis.worker.js  Histogram, K-means, Laplacian chạy ngoài luồng chính
css/style.css          Dark/light, responsive, trạng thái giao diện
worker/                Cloudflare Worker gọi Gemini
public/                PWA manifest, service worker và icon
android/               Project Capacitor tạo bằng `npx cap add android` (không commit)
electron/              Electron main/preload và CSP
scripts/               Tạo/cập nhật manifest tài nguyên Android
core/metrics.test.js   Unit test Vitest
tests/e2e/              Kiểm thử Playwright
```

## Kiểm tra Worker bằng curl

Chạy Worker local bằng `npm.cmd run worker:dev`, sau đó mở PowerShell khác:

```powershell
curl.exe -i -H "Origin: http://localhost:5173" http://127.0.0.1:8787/health
```

Gửi một ảnh JPEG đã mã hóa Base64 (bỏ tiền tố `data:image/jpeg;base64,`):

```powershell
curl.exe -i -X POST http://127.0.0.1:8787/analyze -H "Origin: http://localhost:5173" -H "Content-Type: application/json" --data-raw '{"mode":"single","images":["<BASE64_JPEG>"]}'
```

Với so sánh, dùng `mode` là `compare` và gửi hai chuỗi Base64 trong `images`.


## Device catalog data

See [README_DATA.md](README_DATA.md) for the sourced device catalog, update pipeline, provenance rules, licenses, and coverage report.
