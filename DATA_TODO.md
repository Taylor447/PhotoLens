# PhotoLens — việc còn lại cho dữ liệu thiết bị

Cập nhật: 2026-11-23. Chỉ dữ kiện có provenance mới được đưa vào so sánh; thiếu nguồn thì để null.

## Độ phủ hiện tại

| Tầng | Đã có | Còn thiếu |
|---|---|---|
| 0 — bộ kiểm tra đầu tiên | 5/5 mẫu có nhóm thông số từ trang chính thức: Huawei P60 Pro, Samsung Galaxy S21 Ultra, DJI Osmo Action 4, Apple iPhone 15 Pro, Sony α6400. | Một số trường trên từng máy vẫn null; cần bổ sung từng nhóm sau khi đối chiếu hãng. |
| 1 — mẫu mới/cao cấp | 4 mẫu điện thoại có thông số chính thức: Samsung Galaxy S25 Ultra, Google Pixel 10 Pro, Xiaomi 15 Ultra, OnePlus 13. Cả bốn có ngày phát hành và nguồn chính hãng, thuộc 36 tháng gần nhất tính đến 2026-11-23. | Đây chưa phải bộ bao phủ đủ hãng. Chưa có Tier 1 cho Huawei/Honor/Oppo/vivo/Motorola/Nothing, chưa có máy ảnh mirrorless/compact/action đang bán. |
| 2 — mẫu cũ/thị trường | 7 tên mẫu được giữ từ danh mục PhotoLens cũ, chưa phân tầng và chưa xác minh thông số: Canon EOS R50, Nikon Z fc, Fujifilm X-S20, Panasonic Lumix G9 II, Sony ZV-E10 II, GoPro HERO12 Black, OM System OM-5. | Cần xác minh tên/biến thể và nhập thông số từ nguồn chính thức; không khẳng định các mẫu còn bán. |

## Nguồn Tier 1 đã dùng

- Samsung Galaxy S25 Ultra: trang thông số Samsung Philippines và Samsung Newsroom về ngày mở bán; vùng dữ liệu hiển thị là PH.
- Google Pixel 10 Pro: Google Store US và thông báo sản phẩm Google; vùng thông số là US.
- Xiaomi 15 Ultra: Xiaomi Global specifications và FAQ chính thức về ngày ra mắt/bán.
- OnePlus 13: OnePlus Global specifications và thông cáo ra mắt toàn cầu.

URL và thông báo giấy phép/cách dùng nằm trong `data/sources.json`; provenance theo nhóm thông số nằm trong `data/devices.json`.

## Cần làm tiếp

1. Tuyển chọn các mẫu Tier 1 còn thiếu dựa trên trang hãng, ghi rõ vùng và ngày kiểm tra. Không tự chuyển trạng thái current/discontinued nếu trang hãng không xác nhận.
2. Bổ sung máy ảnh mirrorless, compact và action đang bán; ưu tiên dữ liệu cảm biến, ngàm, AF/IBIS, video, pin và kích thước.
3. Hoàn thiện vùng, biến thể chip/RAM/bộ nhớ và ngày phát hành cho các mẫu cũ sau khi có nguồn tương ứng.
4. Chạy `npm run data:update` trong môi trường có mạng để tạo danh sách ứng viên Wikidata và cập nhật bản Lensfun riêng; danh sách Wikidata chỉ chờ duyệt, không tự nhập thành thông số.
5. Duyệt tay mọi mục `data/review/conflicts.json` trước khi merge. Workflow hàng tháng chỉ mở PR, không tự xuất bản.
6. Kiểm tra quyền phân phối trước khi thêm dữ liệu do cộng đồng cung cấp. Lensfun phải giữ riêng và ghi công theo CC BY-SA 3.0; Wikidata ghi CC0-1.0.

## Cách hiểu báo cáo

`DATA_REPORT.md` ghi số bản ghi theo hãng, loại và tầng, tỷ lệ trường kỹ thuật có dữ liệu, tỷ lệ provenance đã xác minh và kích thước baseline nén. Tỷ lệ module camera tính trên các module đã biểu diễn trong bản ghi; module chưa biết không được đoán thêm. Các tên mẫu cũ không xác minh không được tính là thiết bị verified.
