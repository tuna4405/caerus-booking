# Caerus — AWS Deploy Guide (EC2 + RDS + S3)

Hướng dẫn deploy backend (Express) lên EC2, database lên RDS PostgreSQL, và frontend
(React build) lên S3 static website. Toàn bộ thao tác qua **AWS Console** (trình duyệt) +
**EC2 Instance Connect** (SSH qua trình duyệt, không cần key pair, không cần AWS CLI trên
máy local). Code đã sửa xong trước khi zip — không có bước sửa code nào trên EC2, chỉ có
đúng **1 file cần tạo thủ công trên EC2 là `.env`**.

Region dùng xuyên suốt: **ap-southeast-1**.

---

## ⚠️ Khác biệt so với sơ đồ kiến trúc bạn gửi

Đối chiếu ảnh sơ đồ với code thật trong repo, có 3 điểm khác — **tôi chưa tự ý sửa gì**,
ghi chú lại để bạn quyết định:

1. **API Gateway + Lambda "Generate Ticket" không có trong hướng dẫn này.** Sơ đồ có một
   nhánh API Gateway → Lambda (Generate Ticket) → Database/S3 Tickets. Nhưng trong code
   hiện tại **chưa hề tồn tại** — không có thư mục lambda nào, không có route
   `POST /bookings/:id/ticket`. `docs/api-spec.md` §3.5 ghi rõ đây là tính năng
   **"Week 3 — Lambda"**, tức kế hoạch tương lai, chưa build. Thêm nữa, commit gần nhất
   (`fix: update booking cancellation endpoint to use EC2 instead of Lambda`) cho thấy dự
   án đang đi theo hướng **dùng EC2 cho mọi thứ**, rời xa Lambda. Vì bạn cũng xác nhận
   "Chưa cần đụng đến lambda", guide này **chỉ deploy phần đã có code thật**: EC2 + RDS +
   S3 + VPC Gateway Endpoint. Khi nào Lambda/API Gateway được code thật, cần một guide bổ
   sung riêng.
2. **Monitoring (CloudWatch → Alarm → SNS) không có trong hướng dẫn này** — cùng lý do
   trên, đây là phần mở rộng chưa được yêu cầu, guide này không set up.
3. **Sơ đồ vẽ 3 bucket S3** (Static Website, Images, Tickets) nhưng hướng dẫn bên dưới có
   **4 bucket** — thêm `caerus-backend` chỉ dùng để trung chuyển file zip từ máy bạn lên
   EC2, không phải một phần của kiến trúc runtime nên sơ đồ không vẽ nó cũng hợp lý.

## ⚠️ Cần tự kiểm tra trước khi zip (không phải lỗi tôi được phép sửa, chỉ được viết doc)

`backend/src/app.js` đang whitelist CORS origin là:
```
http://caerus-frontend-web.s3-website-us-east-1.amazonaws.com
```
Region trong URL này là **us-east-1**, nhưng toàn bộ hạ tầng ở guide này (và sơ đồ) dùng
**ap-southeast-1**. Endpoint website thật của bucket `caerus-frontend-web` ở ap-southeast-1 sẽ là:
```
http://caerus-frontend-web.s3-website-ap-southeast-1.amazonaws.com
```
Nếu không sửa lại đúng chuỗi này **trước khi zip** ở Mục 7, trình duyệt sẽ chặn mọi request
từ frontend tới EC2 bằng lỗi CORS ở bước test cuối (Mục 9) — và vì hướng dẫn này không
được phép có bước "sửa code trên EC2", bạn cần tự sửa dòng đó trong `app.js` trên máy local
rồi mới zip.

---

## 1. Security Groups

Tạo trước khi launch EC2, vì EC2 cần chọn SG lúc launch.

**`caerus-ec2-sg`** (EC2 Console → Security Groups → Create security group):
- VPC: Default VPC
- Inbound rules:
  | Type | Port | Source |
  |---|---|---|
  | SSH | 22 | My IP |
  | Custom TCP | 3000 | My IP |

> **Nếu sau này đổi mạng/IP và mất kết nối** (SSH qua Instance Connect lỗi, hoặc frontend
> gọi API bị timeout): vào **EC2 → Security Groups → caerus-ec2-sg → Inbound rules → Edit
> inbound rules**, với cả 2 rule (SSH và Custom TCP 3000) đổi lại Source thành **"My IP"**
> (console tự nhận diện IP hiện tại của bạn) → **Save rules**.

**`caerus-rds-sg`** — tạo luôn ở bước này nhưng **chưa thêm rule nào** (để trống). Inbound
rule của SG này (cho phép EC2 gọi vào RDS) sẽ thêm ở **Mục 5**, sau khi `caerus-ec2-sg` đã
tồn tại để chọn làm Source.

---

## 2. IAM Role cho EC2

**IAM Console → Roles → Create role**
- Trusted entity type: **AWS service**
- Use case: **EC2**
- Bỏ qua bước attach managed policy (Next → Next)
- Name: **`caerus-ec2-s3-role`**

Sau khi tạo xong, mở role → **Add permissions → Create inline policy** → tab **JSON**, dán:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadDeployZip",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::caerus-backend/*"
    },
    {
      "Sid": "ReadWriteImages",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::caerus-images-dev/*"
    },
    {
      "Sid": "ReadWriteTickets",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::caerus-tickets-dev/*"
    }
  ]
}
```

Đặt tên policy: `caerus-ec2-s3-policy` → Create.

> **Vì sao bắt buộc phải có `GetObject` trên `caerus-images-dev/*`:** `getSignedImageUrl()`
> trong [backend/src/lib/s3.js](../backend/src/lib/s3.js) ký presigned URL bằng **chính
> credentials của instance role này** (SDK không truyền credentials tường minh — tự động
> lấy từ EC2 instance profile). Nếu role thiếu quyền `GetObject`, việc ký URL vẫn "thành
> công" về mặt cú pháp (SigV4 signing là phép toán cục bộ), nhưng khi trình duyệt thật sự
> tải ảnh bằng URL đó, S3 sẽ trả **403 AccessDenied** vì role không có quyền đọc.

---

## 3. S3 Buckets

Tạo 4 bucket, region **ap-southeast-1**:

| Bucket | Public access | Ghi chú |
|---|---|---|
| `caerus-frontend-web` | **Public** | Static website hosting |
| `caerus-images-dev` | Private | Poster phim |
| `caerus-tickets-dev` | Private | Vé PDF |
| `caerus-backend` | Private | Chỉ để trung chuyển file zip, không phải runtime |

**`caerus-frontend-web`:**
1. S3 Console → Create bucket → tên `caerus-frontend-web`, region ap-southeast-1.
2. Bỏ tick **"Block all public access"** (xác nhận cảnh báo bằng cách gõ "confirm" nếu
   console yêu cầu).
3. Sau khi tạo xong → tab **Properties** → **Static website hosting** → Enable:
   - Index document: `index.html`
   - Error document: `index.html`
     (dùng chung `index.html` cho error doc vì đây là SPA — React Router xử lý routing
     phía client, F5 ở route con như `/events/3` phải vẫn trả về `index.html`.)
4. Tab **Permissions** → **Bucket policy** → dán:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::caerus-frontend-web/*"
    }
  ]
}
```

**`caerus-images-dev`, `caerus-tickets-dev`, `caerus-backend`:** Create bucket bình thường, **giữ
nguyên "Block all public access" (mặc định ON)** — không cần policy gì thêm, EC2 truy cập
qua IAM role ở Mục 2.

---

## 4. Launch EC2

**EC2 Console → Launch instance**
- Name: `caerus-api`
- AMI: **Amazon Linux 2023**
- Instance type: **t3.micro**
- Key pair: **"Proceed without a key pair"** (dùng EC2 Instance Connect qua trình duyệt,
  không cần .pem)
- Network settings: VPC = Default VPC, Auto-assign public IP = **Enable**, Firewall =
  Select existing security group → **`caerus-ec2-sg`**
- Advanced details → **IAM instance profile** → **`caerus-ec2-s3-role`**
- Tags: thêm tag `Owner` = tên bạn

Launch instance → sau khi state = **Running**, mở instance → tab **Details** → ghi lại
**Public IPv4 address** (dùng lại ở Mục 7 và 8). IP này có thể đổi nếu bạn stop/start
instance, nên nếu làm vậy thì phải cập nhật lại ở Mục 8 và test lại Mục 9.

---

## 5. RDS PostgreSQL

**RDS Console → Create database**
- Choose a database creation method: **Standard create**
- Engine options: **⚠️ hai nút to nằm cạnh nhau là "Amazon Aurora" và "PostgreSQL" — bấm
  đúng nút "PostgreSQL"**, không phải Aurora (kể cả tuỳ chọn ghi "Aurora PostgreSQL
  Compatible" — đó vẫn là Aurora).
- Version: **PostgreSQL 16.x** (bản mới nhất trong dải 16 mà RDS đang hỗ trợ — khớp
  `image: postgres:16` trong [backend/docker-compose.yml](../backend/docker-compose.yml))
- Templates: **Free tier**
- DB instance identifier: `caerus-db`
- Credentials management: **Self managed** (không dùng Secrets Manager)
- Master username: đặt tuỳ ý (ví dụ `caerus`), Master password: tự đặt — **ghi lại**, dùng
  ở Mục 7.
- DB instance class: giữ mặc định free-tier-eligible (db.t3.micro / db.t4g.micro)
- Connectivity:
  - VPC: **Default VPC** (cùng VPC với EC2)
  - Public access: **No**
  - VPC security group: Choose existing → **`caerus-rds-sg`** (bỏ chọn `default`)
- Additional configuration → **Initial database name: `caerus`** (điền ngay lúc tạo, để
  khỏi phải tự `CREATE DATABASE` sau này — schema sẽ nạp thẳng vào DB này ở Mục 7)

Create database → đợi status **Available** (vài phút).

Sau khi Available:
1. Mở **`caerus-rds-sg`** → Inbound rules → Edit inbound rules → Add rule:
   - Type: **PostgreSQL**, Port: **5432**, Source: **Security group** → chọn
     **`caerus-ec2-sg`** (không phải một IP cụ thể — vì EC2 gọi vào RDS qua mạng nội bộ
     VPC, không qua internet).
2. Mở `caerus-db` → tab **Connectivity & security** → ghi lại **Endpoint** (dạng
   `caerus-db.xxxxxxxxxx.ap-southeast-1.rds.amazonaws.com`), dùng ở Mục 7.

---

## 6. VPC Gateway Endpoint cho S3

Để EC2 gọi `caerus-images-dev`/`caerus-tickets-dev` qua đường mạng nội bộ AWS (không qua internet
public) — đây là loại **Gateway** (miễn phí), **không phải Interface endpoint** (loại
Interface tính phí theo giờ + theo GB, không cần ở đây).

**VPC Console → Endpoints → Create endpoint**
- Service category: **AWS services**
- Type: lọc theo **Gateway**
- Service Name: `com.amazonaws.ap-southeast-1.s3`
- VPC: Default VPC
- Route tables: tick chọn route table đang gắn với **subnet public chứa EC2 instance**
  (kiểm tra ở VPC → Subnets → chọn đúng subnet của EC2 → tab Route table để biết route
  table nào)
- Policy: giữ mặc định **Full access**

Create endpoint.

---

## 7. Deploy code lên EC2

Code đã sửa xong ở local — **không sửa gì thêm trong các bước dưới đây**, trừ việc tạo
file `.env`.

### 7.1. Zip và upload lên `caerus-backend` (làm trên máy local của bạn)

Loại trừ `node_modules/`, `.git/`, `.env` khi zip (sẽ cài lại dependency bằng `npm ci` và
tạo `.env` mới trên EC2). Ví dụ với PowerShell:

```powershell
robocopy backend "$env:TEMP\caerus-backend-deploy" /E /XD node_modules .git /XF .env .env.local
Compress-Archive -Path "$env:TEMP\caerus-backend-deploy\*" -DestinationPath "$env:TEMP\backend.zip" -Force
```

Upload `backend.zip` lên bucket `caerus-backend` qua **S3 Console → chọn bucket
`caerus-backend` → Upload → Add files**.

### 7.2. Trên EC2 (mở qua EC2 Console → Connect → EC2 Instance Connect)

```bash
sudo dnf update -y
sudo dnf install -y nodejs20 postgresql16 unzip
```
> Nếu `postgresql16` báo không tìm thấy package, chạy `dnf list postgresql*` để xem
> version thật có sẵn trên AMI và dùng đúng tên đó — chỉ cần bản psql client khớp major
> version 16 với RDS.

```bash
mkdir -p ~/caerus-api && cd ~/caerus-api
aws s3 cp s3://caerus-backend/backend.zip .
unzip backend.zip
npm ci --omit=dev
```
(`npm ci --omit=dev` cài đủ `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`,
`multer` — cả 3 đều nằm trong `dependencies`, không phải `devDependencies`, nên không bị
bỏ qua.)

### 7.3. Tạo `.env` — bước sửa thủ công DUY NHẤT

```bash
nano .env
```

Nội dung (thay giá trị thật vào chỗ `<...>`):

```ini
DATABASE_URL=postgresql://<rds-username>:<rds-password>@<rds-endpoint>:5432/caerus
JWT_SECRET=<một chuỗi ngẫu nhiên dài, ví dụ lấy từ `openssl rand -hex 32`>
PORT=3000
CINEMA_TIMEZONE=Asia/Ho_Chi_Minh
AWS_REGION=ap-southeast-1
S3_BUCKET_IMAGES=caerus-images-dev
S3_BUCKET_TICKETS=caerus-tickets-dev
```

> **`AWS_REGION` phải khớp CHÍNH XÁC region thật của bucket S3** (Mục 3) — sai region sẽ
> khiến `getSignedImageUrl()` sinh ra chữ ký cho endpoint region sai, S3 trả lỗi
> `SignatureDoesNotMatch`/403 mà log không nói rõ nguyên nhân là do region.

Lưu file (Ctrl+O, Enter, Ctrl+X trong nano).

### 7.4. Migration + seed

```bash
psql "$(grep DATABASE_URL .env | cut -d '=' -f2-)" -f db/migrations/001_init.sql
psql "$(grep DATABASE_URL .env | cut -d '=' -f2-)" -f db/seed.sql
```

(`db/seed.sql` đã có sẵn bcrypt hash thật cho `admin@caerus.local` / `password123` — không
cần sửa gì.)

### 7.5. Chạy bằng pm2

```bash
sudo npm install -g pm2
pm2 start src/server.js --name caerus-api
pm2 startup
```
`pm2 startup` sẽ in ra một dòng lệnh bắt đầu bằng `sudo env PATH=...` — **copy đúng dòng đó
và chạy** (nó khác nhau tuỳ máy, không copy từ đây).

```bash
pm2 save
```

### 7.6. Test

```bash
curl http://localhost:3000/api/v1/health
```
Kỳ vọng: `{"ok":true}`

---

## 8. Build & deploy frontend

Trên máy local:

1. Sửa [frontend/.env](../frontend/.env) — `VITE_API_BASE_URL` đang trỏ tới một IP cũ
   (`98.93.254.48`, từ lần deploy trước), đổi thành Public IP mới ghi lại ở Mục 4:
   ```ini
   VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>:3000/api/v1
   ```
2. Build:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   Ra thư mục `frontend/dist/`.
3. **S3 Console → bucket `caerus-frontend-web` → Upload** — chọn **toàn bộ file/folder BÊN TRONG
   `dist/`** (mở thư mục `dist`, chọn hết, kéo thả), **không kéo thả chính thư mục `dist`**
   — nếu không sẽ tạo ra path `caerus-frontend-web/dist/index.html` thay vì
   `caerus-frontend-web/index.html`, static website hosting sẽ không tìm thấy trang.

---

## 9. Test cuối

1. Mở trình duyệt: `http://caerus-frontend-web.s3-website-ap-southeast-1.amazonaws.com`
2. Login: `admin@caerus.local` / `password123`
3. Vào **Manage screenings → Create screening**, tạo 1 event mới, chọn 1 file poster
   (jpg/png) ở phần Poster.
4. Sau khi tạo xong, vào lại event vừa tạo (hoặc trang chủ) — **poster phải hiển thị được,
   không vỡ ảnh, không lỗi trong DevTools Console (F12) dạng 403 Forbidden**.
   - Nếu 403: kiểm tra lại `AWS_REGION` trong `.env` (Mục 7.3) và quyền `GetObject` trên
     `caerus-images-dev/*` của `caerus-ec2-s3-role` (Mục 2).
   - Nếu request tới API bị chặn bởi CORS (lỗi trong Console nhắc tới
     "Access-Control-Allow-Origin"): xem lại cảnh báo ở đầu file này về
     `allowedOrigins` trong `app.js`.

---

## Checklist

- [ ] Mục 1 — Tạo `caerus-ec2-sg` (SSH 22 + TCP 3000, Source = My IP)
- [ ] Mục 1 — Tạo `caerus-rds-sg` (chưa có rule)
- [ ] Mục 2 — Tạo IAM role `caerus-ec2-s3-role` + inline policy 3 bucket
- [ ] Mục 3 — Tạo bucket `caerus-frontend-web` (public, static website hosting + bucket policy)
- [ ] Mục 3 — Tạo bucket `caerus-images-dev` (private)
- [ ] Mục 3 — Tạo bucket `caerus-tickets-dev` (private)
- [ ] Mục 3 — Tạo bucket `caerus-backend` (private)
- [ ] Mục 4 — Launch EC2 (Amazon Linux 2023, t3.micro, no key pair, SG + IAM role đúng)
- [ ] Mục 4 — Ghi lại Public IP
- [ ] Mục 5 — Tạo RDS PostgreSQL (đúng nút PostgreSQL, không phải Aurora)
- [ ] Mục 5 — Thêm inbound rule cho `caerus-rds-sg` sau khi RDS Available
- [ ] Mục 5 — Ghi lại RDS Endpoint
- [ ] Mục 6 — Tạo VPC Gateway Endpoint cho S3, gắn đúng route table
- [ ] Mục 7.1 — Zip backend (loại trừ node_modules/.git/.env) + upload `caerus-backend`
- [ ] Mục 7.2 — Cài nodejs20 + postgresql16 + unzip trên EC2, giải nén, `npm ci --omit=dev`
- [ ] Mục 7.3 — Tạo `.env` trên EC2 (region khớp bucket thật)
- [ ] Mục 7.4 — Chạy migration + seed
- [ ] Mục 7.5 — `pm2 start` + `pm2 startup` + `pm2 save`
- [ ] Mục 7.6 — `curl localhost:3000/api/v1/health` trả `{"ok":true}`
- [ ] Mục 8 — Sửa `VITE_API_BASE_URL` trong `frontend/.env` theo Public IP mới
- [ ] Mục 8 — `npm run build`, upload nội dung `dist/` (không phải thư mục `dist`) lên
      `caerus-frontend-web`
- [ ] ⚠️ Đã sửa `allowedOrigins` trong `backend/src/app.js` cho đúng region
      `ap-southeast-1` TRƯỚC KHI zip ở Mục 7.1
- [ ] Mục 9 — Login admin, tạo event, upload poster, xác nhận ảnh load được (không 403,
      không lỗi CORS)
