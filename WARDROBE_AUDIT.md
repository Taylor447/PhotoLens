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



## Đánh giá hiện tại trên PR #14 · 2026-11-25

Phần bảng đầu tài liệu ghi nhận kiểm định ở mốc ban đầu. Bảng này cập nhật trạng thái theo source code-bearing commit `98b171f`; các commit tiếp theo trên PR chỉ cập nhật tài liệu. Head GitHub hiện là `246fc843eb4bbfdd6c0e33e24b15471bff091f9e`.

| Mục | Trạng thái hiện tại | Bằng chứng và giới hạn |
|---|---|---|
| Kho và thumbnail | PASS trong bộ kiểm định đã chạy | 60 template/12 danh mục, 20 chất liệu, 40 họa tiết, 180 manifest entry và 60 đường dẫn thumbnail riêng. Trước đó Edge đo 60/60 ảnh và 0/60 tên bị ảnh che ở desktop/mobile. Chưa có sản phẩm thương mại hoặc số đo sản phẩm có nguồn. |
| Ma-nơ-canh và morph | PASS về cấu trúc trong phạm vi kiểm tra; PARTIAL về chất lượng sản phẩm | Lưới thân đơn khối, kín và có 17 xương cùng 8 morph theo số đo. Bộ hình học trước đó kiểm tra 1.920 tổ hợp pose/preset/LOD với 0/1.247.864 đỉnh xuyên thân. Chưa có đánh giá trên thiết bị thật. |
| Trang phục 3D và chồng lớp | PARTIAL | 60 mẫu procedural có mesh phân biệt; 416 tổ hợp nhiều lớp thuộc 13 outfit mẫu đạt phép thử giao cắt và giới hạn 150.000 tam giác. Đây chưa phải rập may, sản phẩm thương mại, hay bằng chứng mọi outfit tùy ý đều không giao nhau. GLB nhập phải theo hợp đồng PhotoLens; repo không đóng gói GLB quần áo. |
| GĐ5 phối đồ và Lookbook | PASS trong phạm vi kiểm thử trước; cần chạy lại trên head hiện tại | 2D/3D dùng cùng outfit state; có undo/redo, khóa, chế độ phối, AI chỉ chọn ID trong tập ứng viên và fallback cục bộ. Lưu/xuất Lookbook và gắn vào kế hoạch chụp có trong code. Worker test dùng phản hồi giả lập, chưa xác minh dịch vụ AI trực tiếp. |
| GĐ6 Garment Builder | Có triển khai; nghiệm thu hiện tại PARTIAL | Builder lưu biến thể với màu, chất liệu, họa tiết, cổ, tay, dài/rộng, nếp ly và viền; SVG xem trước mang tính minh họa, không phải rập may. Chưa có kết quả CI mới gắn với head PR hiện tại. |
| GĐ8 kiểm thử và hiệu năng | PARTIAL | Lần kiểm thử cục bộ đầy đủ được ghi nhận trước đó: 55/55 unit, build 319 module, 12/12 Playwright trước thay đổi camera và 1/1 kiểm tra camera sau thay đổi. Lượt chạy mới chưa kết thúc vì auto-review chặn theo dõi tiến trình khi phát hiện HTTPS telemetry tới host chưa xác minh; không đánh dấu bộ test mới là PASS. Không có workflow run/status cho head `246fc8`. Chưa đo FPS Android vật lý, chưa có golden-image baseline. |
| Trạng thái PR | OPEN / DRAFT / CHƯA MERGEABLE | PR #14 vẫn mở, giữ draft, không merge/deploy. Xung đột merge với main/PR #11 vẫn là việc tích hợp riêng cần xử lý trước nghiệm thu cuối. |

Không có mã ứng dụng nào được sửa trong lượt cập nhật audit này. Các kết quả cục bộ cũ không được gán thành CI của head mới.
