# PhotoLens

PhotoLens là ứng dụng tiếng Việt để phân tích, so sánh, chỉnh sửa và chụp ảnh. Phân tích ảnh và Studio chạy trực tiếp trên thiết bị; AI là tùy chọn, chỉ gửi ảnh đã thu nhỏ tới Cloudflare Worker nếu bạn tự cấu hình endpoint.

## Nền tảng

- Web: Windows và trình duyệt hiện đại; GitHub Pages giữ base path `/PhotoLens/`.
- Android: Capacitor Camera, Share và Preferences.
- Windows desktop: Electron, menu ứng dụng và hộp thoại lưu tệp.
- Không bao gồm bản iOS hoặc macOS.

## Chạy web local

Yêu cầu Node.js và npm.

Trong PowerShell trên Windows, dùng `npm.cmd` và `npx.cmd` để tránh lỗi Execution Policy chặn các tệp `npm.ps1`/`npx.ps1`. Trong Command Prompt, có thể dùng `npm` và `npx` như bình thường.

```powershell
npm.cmd install
npm.cmd run dev
```

Mở URL Vite được in trong terminal. Để tạo bản build web:

```powershell
npm.cmd run build
npm.cmd run preview
```

Các phép đo kỹ thuật vẫn dùng được khi offline sau khi ứng dụng đã tải. Gemini cần mạng và Worker đã deploy.

## Cấu hình Cloudflare Worker và Gemini

1. Tạo Gemini API key trong [Google AI Studio](https://aistudio.google.com/app/apikey). Không đặt key trong file frontend, `.env` của Vite hoặc bất kỳ tệp nào được build vào `dist`.
2. Cài Wrangler và đăng nhập Cloudflare nếu máy chưa có:

   ```powershell
   npm.cmd install
   npx.cmd wrangler login
   ```

3. Từ thư mục gốc dự án, lưu khóa dưới dạng secret:

   ```powershell
   npx.cmd wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
   ```

   Dán key khi Wrangler hỏi. Key chỉ được lưu trong secret của Worker.

4. Deploy Worker:

   ```powershell
   npm.cmd run worker:deploy
   ```

5. Mở PhotoLens, nhấn nút hình ngôi sao ở góc phải, dán địa chỉ Worker (ví dụ `https://photolens-ai-proxy.<tai-khoan>.workers.dev`) và lưu.

Có thể giới hạn CORS bằng cách bỏ comment `ALLOWED_ORIGINS` trong `worker/wrangler.toml`, thay bằng danh sách origin thực rồi deploy lại. Web dùng domain của bạn, Android thường dùng `https://localhost`, Electron dùng origin `null`, còn Vite local dùng `http://localhost:5173`. CORS không thay thế xác thực hoặc giới hạn lưu lượng; trước khi mở Worker công khai, nên đặt rate limit bằng Cloudflare.

### Chạy Worker local

Tạo `worker/.dev.vars` từ `worker/.dev.vars.example`, điền Gemini key vào tệp local này rồi chạy:

```powershell
npm.cmd run worker:dev
```

Không commit `.dev.vars`. Worker có endpoint kiểm tra trạng thái tại `/health`.

## Android APK với Android Studio

1. Cài Android Studio và cấu hình Android SDK trên máy.
2. Tạo thư mục nền tảng Android một lần:

   ```powershell
   npx.cmd cap add android
   ```

3. Build web và đồng bộ native project, sau đó mở Android Studio:

   ```powershell
   npm.cmd run cap:android
   ```

4. Trong Android Studio, chờ Gradle sync. Dùng **Build → Build Bundle(s) / APK(s) → Build APK(s)** để tạo APK debug; dùng **Generate Signed Bundle / APK** để tạo bản phát hành có chữ ký.
5. Mỗi lần sửa web, chạy `npm.cmd run cap:sync`, sau đó build/run lại từ Android Studio.

## Windows desktop

Chạy Electron trong môi trường local:

```powershell
npm.cmd run electron:dev
```

Đóng gói bộ cài Windows `.exe`:

```powershell
npm.cmd run electron:build
```

Bộ cài xuất hiện trong `release/`. Electron có menu **Tệp → Mở ảnh**, **Xuất báo cáo PDF**, cùng phím tắt `Ctrl+O` và `Ctrl+S`.

## Cấu trúc

```text
PhotoLens/
├─ core/metrics.js            # Chỉ số, so sánh và điểm kỹ thuật
├─ css/style.css              # Giao diện responsive của ứng dụng
├─ css/studio.css             # Giao diện Studio tải theo nhu cầu
├─ js/main.js                 # Giao diện chính, nhập ảnh, lịch sử, xuất báo cáo
├─ js/studio.js               # Chỉnh sửa ảnh, LUT và camera
├─ js/studio.worker.js        # Xử lý điểm ảnh ngoài luồng chính
├─ js/analysis.worker.js      # K-means và Laplacian ngoài luồng chính
├─ worker/src/index.js        # Cloudflare Worker gọi Gemini
├─ electron/main.js           # Electron main process và menu desktop
├─ electron/preload.js        # Cầu IPC giới hạn quyền
├─ capacitor.config.ts        # Cấu hình Android
├─ vite.config.js
└─ index.html
```

Lịch sử lưu trong `localStorage` trên web, Preferences trên Android và thư mục dữ liệu ứng dụng Electron trên Windows. Ảnh không được thêm vào lịch sử; chỉ lưu chỉ số, nhận xét AI và thumbnail nhỏ.


## PhotoLens Studio

Từ màn hình chính, **Chỉnh ảnh** mở phòng chỉnh sửa cục bộ; **Camera** mở chế độ chụp. Tính năng Studio được tải riêng khi mở, để giữ lần khởi động ban đầu nhẹ.

- Cắt bằng khung tỉ lệ và thanh căn mép; xoay, lật và cân thẳng ảnh.
- Chỉnh phơi sáng, tương phản, vùng sáng/tối, trắng/đen, nhiệt độ, sắc độ, bão hòa, độ rực, HSL tổng thể, đường cong, độ nét, giảm nhiễu, hạt và tối viền.
- Cọ chỉnh phơi sáng cục bộ, xem trước trước/sau bằng cách nhấn giữ, hoàn tác/làm lại.
- Lưu dự án và thông số không phá hủy vào IndexedDB trên thiết bị; mở lại dự án từ Studio.
- LUT mẫu do PhotoLens tự tạo, yêu thích, tìm kiếm, lọc nhóm và nhập LUT 3D `.cube` tối đa 3 MB (kích thước 2–64).
- Xuất JPG, PNG hoặc WebP, chọn chất lượng và kích thước; giữ EXIF chỉ khi người dùng bật lựa chọn và ảnh gốc là JPEG. Có thể đưa ảnh đã chỉnh về ảnh A để tiếp tục phân tích hoặc so sánh.
- Camera dùng `getUserMedia` trên web, cho chọn camera, hẹn giờ, tỉ lệ và lưới. Zoom, bù sáng, lấy nét và đèn flash chỉ xuất hiện khi trình duyệt/camera báo hỗ trợ. Trên Android, nếu camera web không hoạt động, có thể mở Camera native của Capacitor.
- Khung phim, khung Polaroid, nhãn dán, chia sẻ ảnh đã chỉnh sửa hoặc thẻ ghép trước/sau; Android dùng bảng chia sẻ native khi khả dụng. Xử lý ảnh và dữ liệu LUT chạy tại thiết bị; không gửi ảnh tới máy chủ, trừ luồng AI Worker hiện có khi người dùng chủ động bật.

Trình duyệt yêu cầu HTTPS hoặc localhost để xin quyền camera. Camera Windows tùy thuộc thiết bị, quyền hệ điều hành, trình duyệt và HTTPS. Android hỗ trợ camera native qua Capacitor khi ứng dụng được build từ thư mục Android; GitHub Pages chạy camera web và cần HTTPS. Studio giới hạn kích thước xuất tối đa theo thiết bị để tránh vượt bộ nhớ. Cọ vùng là công cụ mask cục bộ; vùng tròn/gradient, điều khiển ISO/tốc độ màn trập thủ công và ghép ảnh nhiều khung chưa có vì không được API camera web hỗ trợ ổn định hoặc cần thêm luồng UI riêng.
