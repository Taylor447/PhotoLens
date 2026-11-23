# Changelog

## 1.1.0 — 2026-11-21

- Gia cố nhập ảnh: kiểm tra magic bytes, giới hạn dung lượng/kích thước giải mã, thông báo lỗi tiếng Việt, hỗ trợ các trường hợp ảnh nhỏ, đen/trắng, PNG alpha và EXIF xoay.
- Chuẩn hóa chỉ số trên ảnh đã thu nhỏ tối đa 1024 px; thêm ngưỡng, trọng số và điểm kỹ thuật trong `core/config.js`.
- Thêm kiểm tra schema AI, tối đa hai lần retry, timeout, hủy yêu cầu, cache theo SHA-256; Worker giới hạn origin, payload, thời lượng và tần suất.
- Bổ sung dark/light, onboarding riêng tư, trạng thái loading/lỗi/trống, accessibility labels, xóa lịch sử và hỗ trợ bàn phím.
- Chuyển histogram, K-means và Laplacian sang Web Worker; lazy-load thư viện HEIC/PDF/PNG.
- Thêm PWA manifest, icon và service worker ngoại tuyến.
- Bổ sung cấu hình Capacitor Android và Electron Windows; giữ iOS/macOS ngoài phạm vi.
- Thêm bộ ảnh fixture, unit test Vitest, E2E Playwright, `.env.example` và hướng dẫn đóng gói.

## 1.0.0

- Bản PhotoLens web ban đầu với phân tích Canvas, so sánh, AI Worker, lưu lịch sử và xuất báo cáo.