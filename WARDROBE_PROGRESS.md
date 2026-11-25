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