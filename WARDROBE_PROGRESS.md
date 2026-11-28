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

## Đánh giá 3D hiện trạng (cập nhật 2026-11-25)

| Hạng mục | Trạng thái | Bằng chứng và giới hạn |
|---|---|---|
| Ma-nơ-canh liền khối và rig | PASS trong phạm vi kiểm thử hình học | Một bề mặt kín dùng chung đỉnh; 17 tên xương, 8 morph và 2 LOD. Tư thế được kiểm tra bằng tam giác, nhưng chưa xác minh hình ảnh mới trong trình duyệt ở checkpoint hiện tại. |
| Số đo cm và xuyên thân | PASS cho lưới procedural đã kiểm tra | 1.920 tổ hợp mannequin/template/tư thế/LOD, 0/1.247.864 đỉnh xuyên thân. Đây là kiểm tra lưới procedural; không chứng minh fit của sản phẩm thật. |
| Trang phục GLB và size có nguồn | FAIL cho dữ liệu đóng gói | Hiện có 0 GLB quần áo và 0 bảng size sản phẩm thương mại đã xác minh. Có hỗ trợ nhập GLB riêng; fit số chỉ có khi người dùng cung cấp số đo món đồ. |
| Giao cắt giữa nhiều lớp | PARTIAL | Bộ kiểm tra có 416 tổ hợp outfit/preset/tư thế/LOD; một số giao cắt ở tay hoặc gấu áo khoác vẫn được cảnh báo. Mô phỏng vải không thay thế kiểm tra GLB nhập. |
| PBR và tài nguyên | PARTIAL | Có 20 chất liệu gán vào 11 profile bề mặt sinh bằng code, map 1024 px; chưa xác minh trực quan sau thay đổi hiện tại. Bảng FPS/GLB load đã thêm nhưng chưa chạy trong trình duyệt. |
| Ngân sách 150k tam giác, LOD, fallback và FPS | PARTIAL | Có budget 150.000 tam giác, LOD 12/20 radial và fallback WebGL2. Chưa có FPS trên Android thật; mục tiêu 60/30 FPS chưa được xác nhận. |

## Checkpoint GĐ0 đã đồng bộ (lịch sử)

Đồng bộ GitHub hoàn tất. Commit b6897e7b17d63d215ea167d08daa28297b3208e6 trên đúng nhánh PR #14 chứa nội dung checkpoint cục bộ 126dc0a.

- CI tại https://github.com/Taylor447/PhotoLens/actions/runs/45400325243: core tests và build site thành công, Pages artifact được tạo. Job deploy bị bỏ qua theo điều kiện PR, production không đổi.
- Playwright tại https://github.com/Taylor447/PhotoLens/actions/runs/45400325018: 7/7 đạt, gồm kiểm tra URL 60 thumbnail, hình riêng và bố cục desktop/mobile, phục hồi ảnh 404, chuyển 2D/3D, Lookbook xuất PNG, offline fallback và mobile emulation.
- Auto-review code scanning tại https://github.com/Taylor447/PhotoLens/actions/runs/45400331499 thành công. PR #14 vẫn mở, chưa merge; head đã xác minh là b6897e7.
- GĐ0 được xác minh hoàn tất. Dừng tại đây theo yêu cầu. GĐ4 chưa tiếp tục trong checkpoint này; GĐ7 vẫn tạm dừng.

## GĐ4 · Ma-nơ-canh và rigging

Mốc trước sửa là PR #14 tại 8d13c568866040036445876229b43ac53bd42eff. Khi kiểm tra trong Edge, lưới cũ có khe ở cổ, eo, hông và chân do các bộ phận đóng riêng rồi gán cứng mỗi bộ phận vào một xương.

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Bề mặt và rigging | PASS | Một lưới liên thông, kín và có hướng mặt nhất quán ở hai mức chi tiết. Giữ 17 tên xương và 8 morph. Vùng khớp trộn tối đa bốn trọng số xương đã chuẩn hóa. |
| Đứng, nghiêng, bước, ngồi | PASS trong phạm vi kiểm thử | 48 tổ hợp gồm 4 preset, 2 tổ hợp số đo biên, 4 tư thế và 2 mức chi tiết. Không phát hiện cặp tam giác không chung đỉnh cắt nhau bằng phép thử cạnh–mặt. Diện tích mặt nhỏ nhất 0,0108 cm². Góc gập hông khi ngồi giảm theo tỉ lệ chiều dài thân và độ sâu hông với số đo biên. |
| Xuyên thân | PASS cho phép đo đỉnh | 1.920 tổ hợp trên 60 mẫu, 4 preset, 4 tư thế và 2 mức chi tiết. 0/201.024 đỉnh nằm bên trong lưới thân. Cảnh thử nhiều món đạt 22.770 tam giác, gồm sàn. |
| Hiển thị | PASS trên Edge | Chụp các góc trước, 45°, bên, sau, 4 tư thế, đổi preset và mặc áo/quần. Kiểm tra thấy WebGL2 hoạt động và không có lỗi JavaScript trên trang. Ảnh Playwright của CI được đính kèm trong artifact Wardrobe browser checks. |
| Mesh trang phục, fit và hiệu năng thiết bị | PARTIAL | Các shell hiện có dùng collider mới. Kiểm thử đỉnh chưa đo giao nhau giữa các lớp. Chất lượng lưới theo mẫu, số liệu sản phẩm và FPS trên thiết bị Android thật còn chờ kiểm định. |

Các tệp chính gồm `features/wardrobe/studio3d/mannequin-surface.js`, `features/wardrobe/studio3d/geometry.js`, `features/wardrobe3d.js` và `tests/wardrobe-3d.test.js`. Manifest ghi nguồn, tác giả và giấy phép cho lưới sinh bằng mã. Playwright có một ca mới để kiểm tra canvas khi xoay bằng bàn phím và chuyển các tư thế.

Kiểm tra cục bộ gồm 47 unit test, Vite build và kiểm tra manifest/asset. Playwright CI chạy trên PR #14. Phần kế tiếp của GĐ4 là lưới trang phục theo từng kiểu dáng và skinning theo lớp.

## GĐ4 · Váy xuyên đùi khi ngồi

- Tái hiện lỗi với áo thun và chân váy xếp ly trong Studio 3D. Bản cũ có thể để mặt tam giác của váy cắt qua đùi dù các đỉnh nằm ngoài thân.
- Bản sửa dựng lại các vòng ngang bao quanh phần thân dưới đã tạo dáng ngồi, dự trù khoảng dịch chuyển của mô phỏng vải. Cùng quy tắc áp dụng cho phần chân váy của đầm. Flat-lay dùng dáng tham chiếu đứng.
- 80 ca kiểm tra giao giữa mặt váy và thân ở tư thế ngồi đạt, gồm 10 mẫu váy/đầm × 4 preset × 2 mức chi tiết. Bộ kiểm tra xuyên đỉnh trên 60 mẫu đo 0/238.384 đỉnh, qua 1.920 tổ hợp. Cảnh thử nhiều món có 28.890 tam giác, gồm sàn.
- Kiểm thử hồi quy dựng chân váy xếp ly trên canvas sau khi chọn tư thế ngồi. Ảnh đối chiếu sử dụng Vite preview trong Edge. Kết quả này đo va chạm thân với phần lai váy, chưa đo giao nhau giữa các lớp vải.

## GĐ4 · Trang phục 3D và chồng lớp

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Hình học theo mẫu | PASS trong phép kiểm tra phân biệt lưới | 60 lưới sinh bằng mã, 12 danh mục. Bộ kiểm tra đặt cùng tên và màu rồi so tọa độ và chỉ số mặt. Áo và quần lấy phần bề mặt tương ứng của rig, cắt cổ/tay/gấu, giữ trọng số khớp. Áo dài minh họa có hai tà xẻ bên. Giày, mũ, túi, kính, khăn, trang sức và phụ kiện tóc có tiết diện/chi tiết theo mẫu. |
| GLB | PASS cho tệp sinh và tải kiểm thử | CLI sinh GLB 2 nhúng skeleton theo quy ước 17 xương, inverse bind, normal và trọng số đã chuẩn hóa. GLTFLoader đọc trực tiếp tệp trong unit test. Kho có 0 tệp GLB đóng gói. |
| Xuyên thân | PASS trong phạm vi phép thử | 0/1.088.640 đỉnh xuyên thân trong 1.920 ca. Phép kiểm tra giao cắt phần váy/đầm với thân đạt 80/80 ca ngồi. Cảnh thử nhiều lớp có 37.014 tam giác, gồm sàn. |
| Giao nhau giữa các lớp | PARTIAL | Lớp ngoài che miền trùng trên thân áo/quần theo thứ tự mặc. Tà áo dài và váy lấy cả bề mặt quần đã tạo dáng khi dựng độ rủ. 12/12 ca của hai bộ mẫu áo dài/quần và váy/quần đạt phép thử giao cắt mặt trên tư thế đứng, bước, ngồi và hai mức chi tiết. Khảo sát bổ sung vẫn tìm thấy một số giao cắt ở tay hoặc gấu áo khoác. Studio hiển thị tên các cặp còn giao nhau. |
| UV, chất liệu và thiết bị | PARTIAL | Vật liệu PBR sinh theo mẫu tiếp tục dùng các map vải hiện có. Các mảnh may mô phỏng dùng tọa độ chiếu tham chiếu, các lai dùng tọa độ dọc theo vòng. Còn cần UV riêng cho các mảnh phức tạp và số đo FPS trên thiết bị thật. |

Tệp triển khai gồm `garment-cuts.js`, `tailored-mesh.js`, `accessory-shells.js`, `surface-crossings.js`, `geometry.js`, `skirt-drape.js`, `export-glb.js` và `wardrobe3d.js`. Ảnh so sánh gồm áo thun, sơ mi, áo dài, áo bà ba, bộ blazer và áo trong, quần jogger và váy ở tư thế ngồi. PR #14 giữ trạng thái draft trong khi kiểm định.

### GĐ4 – Giao cắt ở gấu và tay áo khoác

Mốc đối chiếu là `baa95e8b8686710d5d7771330f33fc05928feee2`. Tái hiện được 8/24 ca giao cắt trên preset B. Hai lớp quanh gấu áo nới theo hướng khác nhau, còn ống tay áo khoác hoặc blazer cắt vào sườn váy hay quần. Ảnh Edge trước sửa tái hiện cảnh báo với áo thun + áo khoác ngắn, sơ mi + quần ống đứng + blazer và đầm cổ vuông + áo khoác ngắn.

| Hạng mục | Trạng thái | Kết quả và giới hạn |
|---|---|---|
| Gấu áo và vùng eo | Đã sửa và bổ sung hồi quy | `tailored-mesh.js` dùng chung hướng nới ra từ tâm thân quanh eo/hông. Hướng nới chuyển dần theo vùng khớp để giữ dáng tay. |
| Tay áo chạm quần hoặc váy | Đã sửa cho nhóm ca ban đầu | `geometry.js` thử nới cánh tay theo ba mức tăng tối đa 15,5°. Giữ nguyên số đo và tư thế gốc khi các lớp đã tách. Chỉ chọn biến thể giảm giao cắt và giữ các cặp đang tách tiếp tục tách. |
| Kiểm thử | Đã mở rộng phạm vi | `tests/wardrobe-3d.test.js` kiểm tra 8 bộ qua 4 preset, 4 tư thế và 2 LOD. Dùng tam giác của mesh đã skinning để kiểm tra lớp, kiểm đỉnh xuyên thân và kiểm tra bề mặt thân ở các tư thế đã nới tay. Playwright chụp blazer, sơ mi và quần ở ba tư thế. CI và ảnh Playwright gắn với [PR #14](https://github.com/Taylor447/PhotoLens/pull/14/checks). |
| Áo choàng và đầm nhiều lớp | PARTIAL | Khảo sát ngoài bộ hồi quy còn thấy áo choàng cosplay cắt qua áo giáp/áo thun, và blazer cắt vào đầm cosplay. Studio vẫn hiển thị tên các cặp giao nhau. Kiểm thử mới đo hình học tĩnh sau khi áp tư thế. Giao cắt lớp trong từng khung của mô phỏng vải chưa được kiểm định. |

Ảnh Edge ở kích thước mobile cho ba bộ ban đầu đều có canvas và không phát cảnh báo giao cắt sau sửa, với mô phỏng vải tắt. Đợt xác minh cục bộ bị gián đoạn, kết quả chính thức lấy từ CI trên commit của PR. Phần chồng lớp GĐ4 vẫn PARTIAL. Tiếp theo ưu tiên biên dạng áo choàng và đầm xoè trong các ca ngoài bộ hồi quy, rồi kiểm tra mô phỏng vải khi mặc nhiều lớp.

### GĐ4 – Áo choàng, đầm nhiều lớp và mô phỏng vải

- `geometry.js` và `skirt-drape.js` dựng áo choàng theo mặt cắt của thân, tay và các lớp bên trong ở tư thế đang dùng. Thân áo khoác được nới theo mặt cắt thực của váy. Khi tay chạm váy xòe, Studio có thể nới góc tay trong giới hạn 15,5° đã dùng ở checkpoint trước.
- Worker kiểm tra đề xuất chuyển động với mặt tam giác đã tạo dáng của ma-nơ-canh và các lớp đồ sinh bằng mã. Nếu một đề xuất gây giao cắt hoặc đưa đỉnh vào trong thân, worker giữ khung gần nhất đã chấp nhận. Đường may giữa hai phần của cùng món được miễn kiểm tra va chạm giữa lớp.
- Bài hồi quy mở rộng từ 8 lên 12 bộ, mỗi bộ qua 4 preset, 4 tư thế và 2 LOD. Bổ sung kiểm tra mặt áo choàng với thân, kiểm tra worker chặn giao cắt với lớp cố định và lớp đang chuyển động, và ca Playwright bật mô phỏng cho váy + áo choàng.
- Đã chạy 8 tick worker trên mỗi bộ: áo giáp + áo choàng ở tư thế bước, áo thun + váy nhiều lớp + áo choàng ở tư thế đứng, và đầm cosplay + blazer ở tư thế ngồi. Tất cả phần vải gửi được 8 khung chuyển động. Các khung lấy mẫu không ghi nhận giao cắt giữa lớp hay đỉnh vải xuyên thân. [Kết quả CI và ảnh Playwright](https://github.com/Taylor447/PhotoLens/pull/14/checks).
- Giới hạn còn lại: ca áo dài + quần chùng + áo khoác ngắn ở tư thế ngồi đã ghi nhận giao cắt quần/áo khoác ở LOD thấp trong khảo sát mở rộng. Kiểm tra chuyển động áp dụng cho đồ sinh bằng mã, chưa đo va chạm với GLB nhập. Chưa đo hiệu năng trên thiết bị di động thật.

### GĐ4 – Ca áo dài, quần chùng và áo khoác ở LOD thấp

Đã thêm bộ điều chỉnh khoảng hở áo khoác theo từng nấc 1,5–6 cm. Bộ dựng thử các nấc sau khi các tư thế nới tay không xử lý được và chỉ giữ biến thể làm giảm giao cắt, đồng thời giữ nguyên các cặp đã tách. Bộ hồi quy tăng lên 13 outfit × 4 preset × 4 tư thế × 2 LOD, tức 416 tổ hợp. Playwright bổ sung ca áo dài, quần chùng, áo khoác ở tư thế ngồi trên viewport mobile và mức chi tiết thấp. Commit `d424cd36798a1e0cc0c6c746d2167354401b8b54` đã lên PR #14. GitHub chưa tạo Actions run cho commit này; check suite Cloudflare Pages và Vercel còn ở trạng thái queued. Unit test và Playwright của commit mới chưa được xác nhận.

Kiểm tra worker ở checkpoint liền trước đạt 8 tick cho ba bộ váy/áo choàng/đầm. Worker chặn đề xuất nếu mặt vải cắt qua lớp khác hoặc đỉnh xuyên thân. Còn cần xác minh lại CI sau khi thêm ca áo dài, cùng giới hạn kiểm tra vải tĩnh với GLB nhập và FPS trên thiết bị di động thật.


## Tiếp tục sau khi khôi phục phiên · 2026-11-25

- Đã xác minh PR #14 vẫn mở, draft, đúng nhánh `codex/wardrobe-gd0-contract-20261124`, head trước thay đổi là `1e00f62221a332d49c5adc08de6d493592557fb9`. Workflow `45416023222` hoàn tất build và core tests thành công; deploy bị skip như cấu hình PR. Workflow đó không chạy Playwright.
- Mở rộng Garment Builder để xem trước SVG động theo màu, họa tiết, chất liệu, cổ, tay, độ dài, độ rộng, số nếp ly và viền; biến thể được lưu vào tủ đồ cục bộ. Cập nhật schema, unit test, Playwright test, CSS và tài liệu. Preview thumbnail tĩnh của 60 template không bị sửa.
- Mã thay đổi đã được rà soát tĩnh trong phiên này; cú pháp JS được phân tích, JSON Schema parse hợp lệ và 60/60 SVG template cho đầu ra byte-identical so với trước thay đổi. Unit test/build/Playwright cho commit mới chưa có kết quả cho tới khi GitHub Actions chạy; trạng thái GĐ6 vẫn PARTIAL. Không đánh dấu đạt trước CI.
- Ảnh 3D tư thế ngồi trước đó chưa được kiểm chứng lại trên trình duyệt của phiên này; kiểm thử hình học tự động không thay thế đánh giá trực quan. GĐ4 và nghiệm thu hình ảnh vẫn PARTIAL.
- GĐ7 tiếp tục tạm dừng theo yêu cầu. Không có thao tác merge hoặc production deploy.

- Tại head hiện tại, truy vấn Actions không có run hoặc commit status cho thay đổi mới. Môi trường chạy lệnh cục bộ cũng không khả dụng; vì vậy chưa có kết quả build, unit test hay Playwright cho commit mới, dù cú pháp JS/JSON và tính bất biến 60 thumbnail đã được kiểm tra trong phiên.

## Tiếp tục kiểm định và sửa căn khung 3D – 2026-11-25

- GitHub xác nhận PR #14 vẫn mở ở trạng thái draft, nhánh `codex/wardrobe-gd0-contract-20261124`, head `7f239c90f43a8d2a5df51b7bdc3d7138cd40c215`. Tại thời điểm kiểm tra không có workflow run hoặc commit status gắn với head này. Không merge hoặc production deploy.
- Trên đúng source của head đó, unit suite trước thay đổi camera đạt 54/54; kho có 60 template/12 danh mục, 20 chất liệu, 40 họa tiết, 180 manifest entry, 60 thumbnail, 0 sản phẩm thương mại và 0 GLB đóng gói. 1.920 tổ hợp mannequin/template/pose/LOD kiểm tra 1.247.864 đỉnh, không đỉnh nào xuyên thân; 416 ca phối lớp và 80 ca váy/đầm ngồi đạt kiểm tra hình học. Cảnh dày nhất trong mẫu đo có 38.742 tam giác, dưới giới hạn 150.000.
- Production build bằng Vite runner chuyển 319 module và hoàn tất; kiểm tra preview trong `dist` đạt. Lệnh build chuẩn không chạy được trong sandbox do esbuild bị từ chối đọc thư mục cha. Cảnh báo chunk lớn vẫn còn (`three` khoảng 753 kB, `heic2any` khoảng 1.353 kB).
- Playwright Edge trên production preview đạt 12/12 ca, exit code 0; bao gồm 60 thumbnail, nhãn/danh mục, chuyển 2D↔3D, mất WebGL, Lookbook/PNG, các pose, đồ nhiều lớp, mô phỏng vải, Builder, offline fallback và viewport Android giả lập. Sau thay đổi camera, ca mannequin/pose chạy lại đạt 1/1; unit kiểm tra mục tiêu camera đạt cho đủ 4 preset × 4 pose. Đây là browser emulation, không phải đo trên Android thật.
- Rà soát ảnh trình duyệt tìm thấy lỗi camera ở tư thế ngồi: target cũ là 39% chiều cao. Bounds của mannequin đã tạo dáng ở preset tham chiếu B là 23,57–169,88 cm, nên tâm đúng là 96,72 cm (56,9%). `mannequinAimHeight` hiện tính tâm từ các đỉnh body đã skinning; giữ nguyên chiều cao camera, tiêu cự và khoảng cách. Ảnh trước/sau được lưu cục bộ tại `outputs/photolens-wardrobe-gd4-seated-before.png` và `outputs/photolens-wardrobe-gd4-seated.png`; sau sửa đầu mannequin nằm trọn trong canvas, browser không có page error.
- Hạn chế hình ảnh còn lại: mannequin và quần áo vẫn là hình học procedural cách điệu; áo ngoài, bề mặt vải và dáng chân ngồi chính diện chưa đạt chất lượng sản phẩm chuyên nghiệp. Chưa có GLB quần áo thực được đóng gói, chưa có số đo sản phẩm thật, chưa đo FPS trên thiết bị vật lý và chưa có golden-image baseline. GĐ4/GĐ8 vì vậy vẫn PARTIAL.
- Rà soát xung đột: PR #11 vẫn mở, head `d94a3261d84f98313a1accfb91d8509fe984e130`; PR #14 chưa chứa commit của PR #11. Merge-tree dự báo hai PR đụng nhau ở `css/planner.css`, `features/planner.js`, `tests/core-planner.test.js`. So với `main` hiện tại (`43220f058cdf7b95ed87387c3654222f67586866`), PR #14 còn xung đột `package.json` và `package-lock.json`; GitHub cũng báo PR #14 chưa mergeable. Chưa sửa các xung đột này vì bước đó cần tích hợp nhánh, và chưa có thao tác merge.
- Working tree cũ `work/visual-audit` được giữ nguyên. Các file GĐ4 cốt lõi trong đó trùng với source PR #14; phần khác biệt Builder/thumbnail vẫn chưa được chép đè lên PR.
### Kết quả cuối trên checkpoint 98b171f – 2026-11-25

- `npm run test:unit` chạy trên đúng tree của checkpoint, exit code 0: 55/55 đạt, 0 lỗi, 181,357 ms. Kiểm tra bao gồm UTF-8, Builder, thumbnail/manifest, rules, Worker, fit và hình học 3D; asset validator báo 60 template, 20 chất liệu, 40 họa tiết, 180 manifest entry, 60 thumbnail, 0 GLB đóng gói và 0 số đo sản phẩm có nguồn.
- Phép đo cuối: 1.920 tổ hợp mannequin/template/pose/LOD, 1.247.864 đỉnh kiểm tra, 0 đỉnh xuyên thân; 416 tổ hợp nhiều lớp và 80 ca váy/đầm ngồi đạt. Phần lớp ghi 0 đỉnh xuyên thân, tối đa 29.318 tam giác.
- Sau sửa camera, Playwright kiểm tra mannequin/pose đạt 1/1; trước sửa này, 12/12 E2E đã đạt trên tree ngay trước camera. Cả lượt đều chạy trên Edge/SwiftShader; đây không phải thiết bị Android vật lý. Ảnh so sánh crop đầu trước/sau vẫn lưu trong thư mục `outputs` cục bộ.
- Build sau sửa đã chuyển 319 module và asset preview validator đạt. Còn cảnh báo chunk lớn: `three` khoảng 753 kB, `heic2any` khoảng 1.353 kB.
- Kiểm tra GitHub ngay sau khi đẩy checkpoint 98b171f vẫn chưa thấy Actions run hoặc commit status. Vì vậy trạng thái CI từ xa là CHƯA CHẠY; các số liệu trên là kết quả chạy cục bộ, không gắn nhãn thành CI GitHub.

## Kiểm định model GLB người dùng gửi - 2026-11-25

| Tệp | Kích thước | Hình học và rig | Kết luận với PhotoLens |
|---|---:|---|---|
| `Meshy_AI_Neutral_Elegance_20261125_texture.glb` | 10.332.424 byte | 123.618 tam giác, 1 mesh, 3 texture; không có skin, xương, animation hoặc morph target. Model là nhân vật đã mặc sẵn trang phục, ở tư thế tay dang. | Nằm trong giới hạn kích thước/tam giác nhưng không thể biến dạng theo số đo hoặc chuyển động cùng rig PhotoLens. Không phải asset quần áo riêng. |
| `HOME_character_sitting.glb` | 13.253.180 byte | 123.618 tam giác, skin 33 xương Mixamo, 1 animation; không có morph target. Mesh đã gồm nhân vật và trang phục ở tư thế ngồi. | Vượt giới hạn nhập 12 MiB hiện tại; tên xương không theo PhotoLens và không có dữ liệu morph theo số đo. |
| `HOME_character_sleep.glb` | 13.248.764 byte | 123.618 tam giác, skin 33 xương Mixamo, 1 animation; không có morph target. Nhân vật/trang phục ở tư thế nằm. | Vượt giới hạn nhập 12 MiB hiện tại; không phù hợp làm mannequin phối đồ. |
| `HOME_character_walk.glb` | 13.285.156 byte | 123.618 tam giác, skin 33 xương Mixamo, 2 animation; không có morph target. Nhân vật/trang phục đã được ghép sẵn. | Vượt giới hạn nhập 12 MiB hiện tại; không phù hợp làm mannequin phối đồ. |

- Cả bốn tệp được phân tích GLB và render thử trong Blender 5.3. Không tệp nào có metadata `asset.extras.photoLens`, giấy phép hoặc thông tin bản quyền. Bộ kiểm tra GLB trong ứng dụng yêu cầu hợp đồng PhotoLens v1; vì vậy các tệp chưa thể được xác nhận là asset fit/rig hợp lệ.
- Không chép các GLB vào kho công khai hoặc thay mannequin mặc định: hiện chưa có dữ liệu giấy phép phân phối, còn hình học không hỗ trợ số đo và clipping theo tiêu chí PhotoLens. Không thay đổi mã nguồn, catalog hoặc PR trong lần kiểm định này; các ảnh render chỉ là bằng chứng xem xét cục bộ, chưa phải kiểm thử tích hợp trong trình duyệt.
- Để dùng làm mannequin phối đồ, cần GLB trung tính, có giấy phép ghi rõ, xương theo `ASSET_SPEC.md` và morph targets gắn với các số đo cm. Model Meshy hiện tại chỉ có thể cân nhắc cho chế độ hình ảnh tĩnh nếu người dùng chấp nhận không có fit/pose theo số đo; các biến thể HOME phù hợp hơn với dự án game riêng.


## Tiếp tục mục chính sau đánh giá GLB - 2026-11-25

- Theo yêu cầu mới, dừng xem xét các model đính kèm cho PhotoLens. Không thêm GLB vào catalog hoặc thay model mặc định.
- PR #14 trên nhánh `codex/wardrobe-gd0-contract-20261124` hiện mở, draft, chưa merge, trạng thái mergeable là false. Head GitHub là `3078557e31d87481135161197229a6f2c0c78a5c`; không có workflow run hoặc commit status gắn với head này. Production không đổi.
- Đã bắt đầu chạy `npm run test:unit` trên source hiện tại. Kiểm tra asset đầu lượt xác nhận 60 template, 180 manifest entry; 12 test đầu xuất hiện trạng thái đạt trong output. Lượt kiểm tra chưa có kết quả kết thúc: yêu cầu tiếp tục theo dõi bị auto-review từ chối vì tiến trình mở kết nối HTTPS telemetry tới host chưa xác minh, payload không rõ. Không đánh dấu toàn bộ unit suite là PASS và không thử vòng tránh.
- Chưa chạy build hoặc Playwright sau head hiện tại. Đây là thay đổi tài liệu, không có mã tính năng mới trong checkpoint này.
- Các mục chính vẫn cần bằng chứng hoàn tất: chất lượng hình ảnh 3D trên ứng dụng thật, golden-image regression, va chạm vải nhiều lớp ngoài bộ 416 trường hợp, GLB đúng hợp đồng PhotoLens, và FPS trên Android vật lý. Không gộp kết quả mô phỏng trình duyệt với số đo thiết bị thật.
- Bước phát triển tiếp theo vẫn thuộc kiểm định GĐ4/GĐ8: hoàn tất xác minh trực quan và đo hiệu năng bằng môi trường có thể chạy kiểm thử mà không phát telemetry ngoài chưa được xác minh; PR vẫn giữ draft và chưa deploy.

## Bổ sung đo hiệu năng cục bộ Studio 3D - 2026-11-25

- Thêm bảng số liệu thuần cục bộ trong canvas Studio 3D: trạng thái kết xuất/nghỉ, FPS chỉ sau cửa sổ đo đủ khung hình, lệnh vẽ, tam giác của khung hình gần nhất so với ngân sách 150.000, số geometry/texture đang hoạt động, thời gian tới khung hình đầu, heap JS nếu Chromium cung cấp và thời gian nạp/kiểm tra GLB cùng số byte.
- Không ước lượng VRAM: giao diện ghi rõ trình duyệt không cung cấp số liệu này. Chỉ số không rời khỏi thiết bị; bảng cập nhật mỗi giây và timer được dọn khi rời studio.
- Thêm hai unit test cho bộ lấy mẫu FPS (đủ mẫu và quay về trạng thái nghỉ). Chưa chạy unit/build/Playwright vì auto-review đã chặn việc chạy lại suite sau khi phát hiện telemetry HTTPS đến host chưa xác minh; không dùng lệnh thay thế để né chặn.
- `node --check` cho mã Studio 3D, helper và test mới: PASS. `git diff --check`: PASS. Chưa có kiểm thử hình ảnh/browser cho bảng mới; CI PR cũng chưa chạy nên thay đổi chưa được xác nhận trên trình duyệt.
- File thay đổi: `features/wardrobe/studio3d/performance.js`, `features/wardrobe/studio3d/materials.js`, `features/wardrobe3d.js`, `css/planner.css`, `tests/wardrobe-3d.test.js`, `data/wardrobe/assets-manifest.json`, `tools/assets/validate-wardrobe.mjs`, `ASSET_SPEC.md`, tài liệu này.
- Tình trạng GĐ8 vẫn PARTIAL. Bước kế tiếp là chạy kiểm thử trong môi trường được phép không phát telemetry, rồi chụp xác minh desktop/mobile và đo FPS thực trên Android; chưa commit/push thay đổi này, không merge/deploy.

## Cải thiện bề mặt PBR tạo bằng code - 2026-11-25

- Thay normal/roughness map dệt chung bằng 11 profile bề mặt tileable, gán đủ 20 chất liệu trong `materials.json`: cotton, linen, denim/twill, wool, silk/satin/chiffon, leather, jersey/knit, canvas, velvet/fleece, lace/tulle và nhóm vải trơn kỹ thuật.
- Mỗi profile tạo normal và roughness map 1024 px từ trường độ cao tham số 128 px; dữ liệu được cache theo profile và trường độ cao dùng lại, trong khi albedo họa tiết tiếp tục lấy theo pattern ID. Không thêm ảnh/texture bên ngoài.
- Bổ sung unit test kiểm tra 20 ID chất liệu đều có profile, đúng 11 kiểu bề mặt phân biệt, và nhóm lụa khác denim. Chưa chạy test vì cùng chặn auto-review đã nêu ở trên.
- Manifest giờ ghi ID, generator, giấy phép, tác giả, kích thước 1024 px, 11 profile và 20 chất liệu; asset validator đối chiếu provenance, generator tồn tại và số profile thực với danh mục.
- `node --check` cho module vật liệu, Studio 3D, helper, asset validator và test mới: PASS; JSON được đọc thành công trong bước rà manifest; `git diff --check`: PASS. Chưa có ảnh trình duyệt chứng minh chất lượng map; thay đổi PBR hiện PARTIAL cho đến khi kiểm tra trực quan và build được phép chạy.

## Tiếp tục hoàn thiện đo hiệu năng và báo cáo - 2026-11-25

- Bảng đo Studio 3D thêm thời gian/byte cho bước đọc, parse và kiểm tra GLB cục bộ. Không có GLB thì hiện “Không dùng GLB”; flat-lay hiện “Không áp dụng”, tránh số liệu chờ vô hạn.
- Asset manifest validator giờ kiểm tra PBR generator là mã có thật và đối chiếu 20 chất liệu/11 profile với module. JSON manifest parse được; chưa chạy validator vì không chạy test suite.
- Sửa bảng trạng thái đầu tài liệu: cập nhật mannequin liền khối là PASS trong kiểm tra hình học; giữ PARTIAL cho giao cắt lớp, chất lượng ảnh, và FPS trên thiết bị thật. Đổi mục checkpoint GĐ0 cũ thành lịch sử; cập nhật README mô tả đúng bảng đo và giới hạn GPU memory.
- `node --check` cho các module/test/validator, parse JSON và `git diff --check`: PASS ở checkpoint này. Unit test, build, Playwright và CI chưa chạy; thay đổi không được commit/push, merge hay deploy.
- File mới/sửa bổ sung: `README_WARDROBE.md`, `WARDROBE_PROGRESS.md`, `features/wardrobe3d.js`, `tools/assets/validate-wardrobe.mjs`, `data/wardrobe/assets-manifest.json`.

## Rà soát tĩnh nguồn kết nối ngoài trong test - 2026-11-25

- `git grep` trên `tests/`, `tools/` và manifest script không tìm thấy khai báo telemetry/analytics (Sentry, PostHog, Segment, Mixpanel, Amplitude) hoặc lệnh kết nối telemetry. URL trong test là giá trị giả `worker.invalid`, `worker.example`, `allowed.example`, hoặc URL độc hại dùng để kiểm tra SVG sanitizer; lời gọi Worker trong test dùng `worker.fetch` giả.
- `test:unit` chạy kiểm tra preview cục bộ, các tệp `node --test`, rồi asset validator. Worker duy nhất có `fetch` trực tiếp là `workers/wardrobe-cutout.worker.js`, không nằm trong import graph của các test; nó chỉ tải model khi người dùng bấm nút cắt nền trong trình duyệt.
- Vì auto-review không cung cấp host/stack trace/payload cho người dùng và lượt từ chối trước đó cấm chạy lại hay chuyển sang CI/trình duyệt để né chặn, chưa xác định được nguồn HTTPS bên ngoài. Không thay đổi test hoặc dependency để che cảnh báo.
- Chỉ có thể tiếp tục kiểm tra tĩnh trong phiên này. Unit/build/Playwright, commit và push vẫn chưa xác minh; cần lưu chi tiết chặn từ hệ thống review hoặc dùng môi trường kiểm thử được phê duyệt trước khi nghiệm thu.

## Bổ sung kiểm tra giao cắt GLB với lớp trang phục - 2026-11-25

- GLB nhập cục bộ giờ được lấy bề mặt tam giác sau khi gắn vào xương/anchor rồi so với các lớp khác bằng phép kiểm tra giao cắt tam giác. Lớp GLB đã nạp dùng hình học GLB thật; lớp chưa nạp dùng mesh procedural hiện có làm đối chiếu.
- Nếu GLB vượt ngưỡng xuyên thân hiện có hoặc cắt lớp khác, món đó giữ mesh procedural thay vì ẩn mesh dự phòng. Tệp người dùng vẫn được đọc cục bộ, không gửi đi.
- Thêm unit test cho lớp giao cắt: một tam giác cắt lớp khác phải nhận ra đúng ID món; mặt cách xa phải không báo nhầm. Chưa chạy unit test do auto-review đang chặn.
- `node --check` cho Studio, crossing helper và tests; `git diff --check`: PASS. Chưa có xác minh unit/build/Playwright hoặc GLB thật, nên guard này hiện PARTIAL và không được coi là đã kiểm chứng.

## Kiểm tra unit và asset do người dùng chạy - 2026-11-25

- Người dùng chạy `npm run test:unit` trong thư mục dự án. Ảnh kết quả cuối cho thấy **59/59 test đạt, 0 lỗi, 0 bị hủy, 0 bỏ qua**; asset validator chạy sau test và kết thúc thành công.
- Validator báo **60 template** (5 cho mỗi 12 danh mục), **60 thumbnail**, **180 manifest entry**, **20 chất liệu**, **11 profile texture procedural**, **40 họa tiết**, **60 tham chiếu SVG**, **60 tham chiếu 3D procedural**, **0 GLB**, **0 sản phẩm thật** và **0 mẫu có số đo sản phẩm được xác minh**. Đây là mẫu sinh bằng code, không phải 60 sản phẩm thương mại hay GLB thật.
- Kết quả này xác nhận unit suite và kiểm tra manifest/asset cục bộ tại working tree hiện tại; chưa xác nhận build, CI, Playwright, hình ảnh trên trình duyệt, va chạm với GLB thật hay hiệu năng Android vật lý. GĐ4/GĐ8 vẫn PARTIAL.
- Ảnh kết quả do người dùng cung cấp; chưa có commit hoặc push mới. Working tree vẫn ở detached HEAD `e597fb0d161ded842d41b662d238d03aebef0e26` với các thay đổi chưa commit được bảo toàn. Không merge hoặc deploy.

## Rà soát trực quan preview mobile - 2026-11-25

- Ảnh preview người dùng gửi cho thấy thẻ món đồ ở bố cục hai cột có nút “Mặc thử” bị xuống dòng/cắt ở vùng hành động. Đã cập nhật CSS để hàng hành động chiếm đủ chiều rộng, nút co giãn theo cột, căn giữa chữ và cho phép xuống dòng; chiều cao hàng nút tự theo nội dung.
- Ảnh Studio 3D cho thấy hình mannequin gần sát mép trên/dưới và silhouette còn rất thô. Chưa thể xác định từ ảnh khoảng cách camera đã được người dùng thu phóng hay chưa; chưa chỉnh camera để tránh làm sai các thiết lập Góc chụp. Chất lượng hình ảnh Studio 3D vẫn PARTIAL.
- CSS mới chưa được xác minh trên bản build/preview sau sửa. `git diff --check` PASS; không chạy lại unit test. Trong `package.json` hiện không có script/dependency Playwright; cần xác minh thủ công trên preview hoặc bổ sung cấu hình Playwright sau.

## Sửa hình mannequin Studio 2D - 2026-11-25

- Nguyên nhân: `buildSvgLook()` dựng thân bằng một polygon góc cạnh rồi vẽ tay/chân bằng các nét thẳng dày; vì vậy thân dưới trông như một khối liền và các chi không có hình dáng rõ.
- Đã thay phần mannequin SVG bằng silhouette trung tính có đường cong, tách thân, cổ, đầu, hai tay, hai chân và bàn chân; mọi điểm vẫn lấy từ cùng bộ anchor cm nên trang phục và fit SVG giữ chung hệ tọa độ. Giữ mannequin không mặt và màu do người dùng chọn.
- Thêm regression test kiểm tra đủ các phần cơ thể và đường cong trong SVG. `node --check` cho module và test: PASS; `git diff --check`: PASS. Unit test chưa chạy lại theo giới hạn auto-review đã nêu.
- Chưa build/refresh preview nên chưa xác nhận ảnh sau sửa. Studio 2D vẫn PARTIAL tới khi xem trực tiếp trên preview và kiểm tra tư thế/nhiều lớp.


## GitHub push checkpoint - 2026-11-28

- Pushed the verified working-tree changes to PR #14 branch codex/wardrobe-gd0-contract-20261124. Commit: 6c562e3473488fa08f9cc2c843ad3e95a04e469f.
- PR #14 remains open and draft. No merge or production deployment was performed.
- GitHub Actions workflow lookup for this commit returned zero runs at check time; CI and Playwright are not claimed as passing for this commit. The user-provided local unit-test screenshot showed 59/59 passing before this push.
