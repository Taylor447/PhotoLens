# PhotoLens: dữ liệu thiết bị

Bộ dữ liệu là một danh mục có nguồn, không phải cam kết bao phủ mọi thiết bị. Mỗi thông số được lưu cùng nguồn, ngày lấy, giấy phép/cách sử dụng, phương thức trích xuất và trạng thái xác minh.

## Tệp chính

- `data/devices.json`: nguồn dữ liệu thiết bị cho app và baseline.
- `data/sources.json`: registry nguồn, mức ưu tiên và quy tắc sử dụng.
- `data/schema/device.schema.json`: schema JSON, phiên bản 2.
- `data/lensfun-derived.json`: dữ liệu dẫn xuất từ Lensfun, tách riêng theo CC BY-SA 3.0.
- `data/imports/`: bản ghi nhập từ người dùng; không tự ghi đè dữ liệu đang có.
- `data/overrides/`: ghi đè thủ công dạng YAML giới hạn.
- `data/raw/`: dữ liệu thô kèm hash, nguồn và ngày tải; thư mục này không được đưa vào bundle ứng dụng.
- `data/review/conflicts.json`: xung đột cần con người xử lý.
- `public/data/`: đầu ra build, được tạo tự động và bỏ qua trong Git.
- `DATA_REPORT.md`: báo cáo độ phủ được sinh từ dữ liệu thật.

## Quy tắc nguồn và xác minh

1. Trang thông số chính thức được ưu tiên. Chỉ chép dữ kiện, không chép văn bản quảng cáo, ảnh, bài đánh giá hay điểm số camera.
2. `verified: true` chỉ dùng khi thông số được kiểm tra trên trang chính thức hoặc có ít nhất hai nguồn độc lập khớp nhau. Các nguồn cần nằm trong `data/sources.json`.
3. Wikidata (CC0-1.0) dùng để tìm ứng viên và tên thay thế; dữ kiện không tự động đi vào danh mục.
4. Dữ liệu Lensfun được ghi công riêng, giữ giấy phép CC BY-SA 3.0 và không trộn vào danh mục dữ kiện hãng.
5. Nguồn hãng không nêu giấy phép tái phân phối riêng cho thông số. PhotoLens chỉ lưu các giá trị thực tế và liên kết nguồn; không lưu nội dung trang hoặc ảnh.
6. Không có nguồn thì dùng `null` hoặc bỏ dữ kiện. `null` được hiển thị là “Chưa có dữ liệu”, không bị tính thành 0.

## Lệnh

```sh
npm run data:check
npm run data:report
npm run data:build
npm run data:fetch
npm run data:update
npm run data:import -- --file ./my-devices.csv --source "Tên nguồn" --license "Giấy phép"
# Thêm --url "https://example.org/specs" khi nguồn có trang web công khai
```

- `data:fetch` chỉ lấy ứng viên từ Wikidata Query Service và XML Lensfun đã đăng ký; pipeline không cào trang thông số thương mại của hãng.
- `data:update` chạy fetch, chuẩn hóa Wikidata thành danh sách ứng viên cần duyệt, chuẩn hóa Lensfun, gộp bản nhập, áp dụng override, kiểm tra JSON Schema/provenance rồi build. Có xung đột thì dừng trước khi thay `data/devices.json` và ghi `data/review/conflicts.json`.
- `data:import` nhận CSV hoặc JSON. CSV hỗ trợ cột dạng `sensor.megapixels`; `aliases` và `regions` phân tách bằng dấu chấm phẩy. Bản ghi nhập luôn bắt đầu `verified: false`. Nếu không có URL công khai, importer tạo URN `urn:photolens:local-import:...`, lưu tên tệp và hiển thị nguồn cục bộ không có liên kết web.
- Override YAML dùng `id`, `set` và các khóa dotted path. Mỗi giá trị kỹ thuật được sửa phải khai báo đầy đủ provenance trong cùng nhóm (`sourceId`, `url`, `retrievedAt`, `license`, `extractedBy`, `verified`); thiếu thì pipeline dừng.
- `data:build` tạo manifest, chỉ mục tìm kiếm, từng tệp thiết bị, baseline gzip và báo cáo. Build thất bại nếu dữ liệu sai hoặc baseline vượt 3 MiB.

## Manifest và cập nhật trong ứng dụng

`manifest.json` chứa `dataVersion`, `builtAt`, `schemaVersion`, số lượng, độ phủ và SHA-256 từng tệp. Ứng dụng cài baseline vào IndexedDB, hoạt động ngoại tuyến, kiểm tra manifest tối đa một lần mỗi ngày, gửi ETag, xác minh hash trước khi lưu và giữ bản trước để quay lui. Các cập nhật ghi vào IndexedDB trong một transaction.

Mặc định app lấy dữ liệu từ `/PhotoLens/data/` theo `BASE_URL`. Có thể đặt `VITE_DEVICE_DATA_URL` cho nơi lưu trữ khác. Có thể bật “Chỉ cập nhật khi có Wi-Fi”; nếu trình duyệt không tiết lộ loại kết nối, thao tác cập nhật bị hoãn cho đến khi tắt tùy chọn này. Xóa dữ liệu đã tải không xóa bộ nhúng hoặc danh sách “Thiết bị của tôi”.

## Đóng góp và cập nhật định kỳ

Thêm dữ liệu qua importer hoặc PR có nguồn và giấy phép. Không nhập dữ liệu mà người đóng góp không được phép phân phối. Workflow `.github/workflows/device-data.yml` chạy hàng tháng, tạo PR để xem xét và không tự xuất bản. Mọi xung đột phải được duyệt thủ công.

## Giới hạn hiện tại

Danh mục có 16 bản ghi: 5 mẫu Tier 0 và 4 mẫu điện thoại Tier 1 đã có dữ kiện từ nguồn hãng; 7 tên mẫu cũ còn lại chỉ giữ thông tin định danh, thông số để trống và chưa phân tầng. Đây chưa phải danh mục đầy đủ các hãng hoặc loại máy. Xem `DATA_TODO.md` để biết khoảng trống còn lại.

## Ghi công

- Wikidata Query Service — CC0-1.0.
- Lensfun camera database contributors — CC BY-SA 3.0; dữ liệu được giữ riêng trong `data/lensfun-derived.json`. Xem giấy phép tại `https://github.com/lensfun/lensfun/blob/master/data/COPYING.CC_BY-SA_3.0`.
- OpenStreetMap và các nguồn thời tiết của ứng dụng được ghi công tại các màn hình tương ứng; chúng không phải nguồn dữ liệu thông số thiết bị.