# Kiểm định Wardrobe Studio · PR #14

Mốc bắt đầu: main `8a009014b383b8b5891af7a32453b5df2fe69a04`, PR #14 `8db9116ce76020b17d1a035f3b202ddb003940ef`, PR #11 `d94a3261d84f98313a1accfb91d8509fe984e130`. Artifact GitHub Pages của lượt [CI 45348949771](https://github.com/Taylor447/PhotoLens/actions/runs/45348949771) thuộc head PR #14. Các máy chủ Vite trên cổng 5173 và 5174 không công bố SHA. Dữ liệu phục vụ từ cả hai có lỗi tiếng Việt. Bản trên 5174 trả đúng byte của thumbnail áo thun được sinh lại từ mã ở head PR. Không thể suy SHA của cả máy chủ chỉ từ tệp ảnh này.

| Chức năng | Trước sửa và nguyên nhân | Chỉnh sửa, tệp | Kiểm chứng và phần còn lại |
|---|---|---|---|
| Liên kết ảnh kho | PASS trên bản build CI. Có 60 URL riêng, toàn bộ trả 200. Bộ sinh chạy trước test và có thể che sai khác giữa file đã commit và đầu ra thực. | Giữ đường dẫn và ID. | Phải kiểm tra cả nội dung hình và file đã commit. |
| Nội dung tiếng Việt | FAIL. 103 ký tự U+FFFD trong catalog, ngoài ra nhiều dấu bị biến thành dấu hỏi. | Khôi phục name và culturalNote theo ID từ Git 59c24a2. Phục hồi metadata model từ cùng nguồn. Chỉ sửa tên bản sao cục bộ khi khớp chính xác tên hỏng đã biết. | garments.json, assets-manifest.json, legacy-preview-names.json, wardrobe-studio.js. |
| Thẻ trang phục | FAIL. Ảnh SVG có tỷ lệ nội tại tràn ra ngoài ô 100 px, đè lên tên trên Edge. | planner.css đặt vùng ảnh riêng và cố định thứ tự dòng, giữ tên dài được xuống hàng. | So ảnh trước/sau, cả desktop và mobile. |
| Rập 2D, thumbnail | PARTIAL. Đường dẫn riêng nhưng bốn mẫu áo dùng cùng hình bao. Thumbnail chứa cả mannequin và chú thích bé. | Đánh giá hình bao độc lập với tên, màu và pattern. | So đủ 60 mẫu. |
| Ma-nơ-canh 3D | FAIL về cấu trúc bề mặt. 17 xương, tám morph và clipping có test. Thân, cánh tay và chân là những mesh đóng riêng, mỗi đỉnh có một trọng số 1. | Giữ hệ neo cm, quy ước xương và bộ kiểm tra clipping. | Cần mesh liền, trọng số chuyển tiếp và xác minh khi ngồi. |
| Bảng size, fit | PARTIAL. Có phép trừ cm và xử lý thiếu dữ liệu. 0 mẫu có bảng size sản phẩm xác minh. | Giữ trạng thái thiếu dữ liệu và kiểm tra các bảng size tự nhập. | Chưa thể xác nhận mặc vừa sản phẩm thật. |
| Rules, AI, Lookbook | PARTIAL. CI đã xác nhận fallback, allowlist, lưu và xuất PNG, WebGL context loss. | Kế thừa kiểm thử hiện tại. | Cần đối chiếu UI và các giới hạn điểm theo từng ngữ cảnh. |
| Hiệu năng | PARTIAL. Có đếm tam giác và kiểm thử viewport di động giảm tốc CPU. | Kiểm tra riêng số liệu renderer. | Chưa đo FPS trên Android thật. |
| Tích hợp PR #11 | PARTIAL. Thử hợp nhất bằng git merge-tree gặp xung đột tại css/planner.css, features/planner.js và tests/core-planner.test.js. | PR #14 hiện tự chạy với module Góc chụp của main. | Khi tích hợp #11 cần giữ cập nhật camera/lens và cả hai bộ test. |

GĐ7 chờ xác nhận. Production cần người dùng duyệt preview. Mốc sau ghi nối tiếp trong tài liệu này.

