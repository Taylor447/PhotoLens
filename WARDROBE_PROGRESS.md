# Tiến độ khôi phục và sửa kho trang phục

Cập nhật 24-11-2026. Nhánh PR #14 là `codex/wardrobe-gd0-contract-20261124`. Checkpoint GitHub trước đợt sửa thumbnail là `e1f3ae370b0c4b6cf3b2666bb08969db679fe67a`. PR #14 còn mở, chưa merge, và production chưa được triển khai.

## Phục hồi

- Có 72 mục sửa đã stage sẵn từ phiên Work trước. Giữ nguyên nội dung và hoàn tất nhóm dở dang.
- Kết quả CI trước đó ở `e1f3ae3`: 42 kiểm thử đơn vị và 4 Playwright qua. Bản Pages cho pull request được build, bước deploy production bị bỏ qua.
- PR #11 còn mở và có xung đột với PR #14 ở `css/planner.css`, `features/planner.js`, `tests/core-planner.test.js`. Chưa tích hợp PR #11.

## Kết quả hình ảnh đã đo

Đo hai bản build trên Microsoft Edge 158, 60 món, desktop 1440×980 và mobile 412×915.

| Đo đạc | Bản trước | Bản sửa |
|---|---:|---:|
| Ảnh tải và giải mã | 60/60 mỗi viewport | 60/60 mỗi viewport |
| Hình raster khác nhau | 28/60 | 60/60 |
| Tên bị ảnh phủ | 60/60 | 0/60 |
| Khoảng cách nhỏ nhất ảnh đến tên | −50 px desktop, −60 px mobile | 6 px |
| Chiều cao thẻ | 4 mức desktop, 3 mức mobile | 1 mức mỗi viewport |
| Console/page errors | 0 | 0 |
| Khôi phục đúng SVG sau HTTP 404 | không | có |

Các hình là SVG vẽ bằng mã, không phải ảnh chụp sản phẩm. Mỗi mẫu có hình dáng riêng, năm mẫu trong mỗi 12 danh mục. Thư viện có 20 preset chất liệu và 40 họa tiết lặp. Màu, chất liệu, họa tiết, độ rộng và độ dài được áp dụng lên hình xem trước. Không suy đoán thuộc tính từ ảnh cơ thể.

## Sửa đổi và kiểm thử

- Khôi phục tên tiếng Việt từ lịch sử Git và thêm kiểm tra giải mã UTF-8 nghiêm ngặt.
- Sinh thumbnail riêng, cập nhật manifest và kiểm tra byte ảnh đã commit so với đầu ra sinh để test/build không che sai khác.
- Cố định hàng ảnh, tách nội dung và giới hạn vùng ảnh để tên không bị che. Nút yêu thích gọn, có nhãn truy cập.
- Ảnh lỗi 404 được vẽ lại bằng hình học đúng ID. Ảnh người dùng giữ local.
- Edge kiểm tra cả hai viewport. Trước sửa chỉ có 28 hình ảnh raster khác nhau dù 60 URL đều 200. Sau sửa có 60.
- `npm run test:unit`: 45/45 PASS. Build Vite và kiểm tra asset PASS. Build có cảnh báo chunk lớn hơn 500 kB.
- Playwright tự động mới đã được thêm cho 60 ảnh, bố cục, UTF-8 và trường hợp 404. Chờ auto-review CI để xác nhận kiểm thử này.

## Đánh giá 3D hiện trạng

| Hạng mục | Trạng thái | Bằng chứng và giới hạn |
|---|---|---|
| Số đo cm, preset, morph, kiểm tra clipping | PARTIAL | Kiểm thử có 60 mẫu × 4 preset × 4 tư thế × 2 LOD, 0/201.024 đỉnh bị tính là xuyên thân. Chưa đo giao nhau giữa các lớp hoặc độ rủ vải. |
| Ma-nơ-canh liền khối, skinning liên tục | FAIL | Mã đang dùng các mesh bộ phận rời và trọng số khớp cứng. Test số đo/clipping không chứng minh lưới liền. |
| Quần áo GLB và bảng size đã xác thực | FAIL | Có 0 GLB quần áo và 0 bảng size thương mại xác minh. Fit chỉ đối chiếu khi có số đo món đồ. |
| Ngân sách 150k tam giác, LOD, fallback | PARTIAL | Mã có giới hạn và nhánh fallback. Cần test trình duyệt sau sửa và đo thiết bị thật cho FPS. |

## Việc còn lại

Đồng bộ GitHub hoàn tất. Commit b6897e7b17d63d215ea167d08daa28297b3208e6 trên đúng nhánh PR #14 chứa nội dung checkpoint cục bộ 126dc0a.

- CI tại https://github.com/Taylor447/PhotoLens/actions/runs/45400325243: core tests và build site thành công, Pages artifact được tạo. Job deploy bị bỏ qua theo điều kiện PR, production không đổi.
- Playwright tại https://github.com/Taylor447/PhotoLens/actions/runs/45400325018: 7/7 đạt, gồm kiểm tra URL 60 thumbnail, hình riêng và bố cục desktop/mobile, phục hồi ảnh 404, chuyển 2D/3D, Lookbook xuất PNG, offline fallback và mobile emulation.
- Auto-review code scanning tại https://github.com/Taylor447/PhotoLens/actions/runs/45400331499 thành công. PR #14 vẫn mở, chưa merge; head đã xác minh là b6897e7.
- GĐ0 được xác minh hoàn tất. Dừng tại đây theo yêu cầu. GĐ4 chưa tiếp tục trong checkpoint này; GĐ7 vẫn tạm dừng.
