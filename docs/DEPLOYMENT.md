# Deployment guide (AWS, beginner friendly)

You will end up with:

| Piece | Service | Why |
|---|---|---|
| Database | **MongoDB Atlas** (free/shared tier to start) | Managed Mongo; no servers to patch |
| Documents | **Amazon S3** | Durable file storage, browser uploads via presigned URLs |
| API | **AWS App Runner** running the Docker image from **Amazon ECR** | Simplest managed container hosting: HTTPS, auto-scaling, zero servers |
| Frontend | **AWS Amplify Hosting** | Builds the React app from GitHub and serves it on a CDN with HTTPS |

Estimated cost for a small team: Atlas M0 free (or M10 ≈ $9/mo), App Runner ≈ $5–15/mo at 0.25 vCPU / 0.5 GB with a single instance, Amplify ≈ $1–3/mo, S3 cents. Everything below uses the AWS Console; the CLI equivalents are noted where useful.

> **Region:** pick one region for everything (e.g. `ap-south-1` Mumbai). The instructions assume it throughout.

---

## 0. Before you start

1. Create two GitHub repositories and push the code: `lead-crm-backend` and `lead-crm-frontend`.
2. Have an AWS account with a user that can create ECR, App Runner, Amplify, S3 and IAM resources.
3. Install Docker Desktop and the AWS CLI on your laptop (only needed for the first image push; the CI workflow can do it later).

---

## 1. MongoDB Atlas

1. Sign up at mongodb.com/atlas → **Create a cluster** → choose *Free (M0)* or *M10*, same region as AWS.
2. **Database Access** → Add user, e.g. `leadcrm` with a strong password, role *Read and write to any database*.
3. **Network Access** → Add IP → *Allow access from anywhere* (`0.0.0.0/0`). App Runner egress IPs are dynamic; if you want a fixed IP later, put App Runner in a VPC with a NAT gateway (see Atlas docs "VPC peering") — not needed to start.
4. **Connect** → *Drivers* → copy the connection string. It looks like
   `mongodb+srv://leadcrm:<password>@cluster0.xxxxx.mongodb.net/lead_crm?retryWrites=true&w=majority`
   Replace `<password>` and keep `/lead_crm` as the database name. This is your `MONGODB_URI`.

---

## 2. S3 bucket for documents

1. S3 → **Create bucket**, name e.g. `leadcrm-docs-prod-<yourcompany>`, same region, *Block all public access* **on** (we never make objects public — downloads are presigned).
2. Bucket → **Permissions** → **CORS** → paste (replace the Amplify domain later once you have it; `*` is fine for the first test):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://main.xxxxxxxx.amplifyapp.com", "http://localhost:5173"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

3. (Optional) **Management → Lifecycle rule**: move objects under `*/imports/` to Infrequent Access after 30 days.

---

## 3. IAM role for the API (so no access keys live in env vars)

1. IAM → **Policies → Create policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::leadcrm-docs-prod-<yourcompany>/*"
  }]
}
```
   Name it `LeadCrmS3Access`.
2. IAM → **Roles → Create role** → *Custom trust policy*:

```json
{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Principal": { "Service": "tasks.apprunner.amazonaws.com" }, "Action": "sts:AssumeRole" }] }
```
   Attach `LeadCrmS3Access`. Name it `LeadCrmAppRunnerInstanceRole`. This is the **instance role** App Runner will use — the AWS SDK in the API picks it up automatically, so leave `AWS_ACCESS_KEY_ID`/`SECRET` empty in production.

---

## 4. Build and push the API image to ECR

1. ECR → **Create repository** → name `lead-crm-backend` (private).
2. On your laptop, in the backend folder (replace `123456789012` with your AWS account id and region as needed):

```bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-south-1.amazonaws.com
docker build -t lead-crm-backend .
docker tag lead-crm-backend:latest 123456789012.dkr.ecr.ap-south-1.amazonaws.com/lead-crm-backend:latest
docker push 123456789012.dkr.ecr.ap-south-1.amazonaws.com/lead-crm-backend:latest
```

Later you can let GitHub Actions do this (add ECR login + push steps to `.github/workflows/ci.yml` using `aws-actions/amazon-ecr-login`).

---

## 5. App Runner service

1. App Runner → **Create service** → *Container registry* → *Amazon ECR* → browse to `lead-crm-backend:latest`.
2. Deployment: *Automatic* (redeploys when you push a new `latest` tag). ECR access role: let the wizard create one.
3. **Service settings**
   * Name: `lead-crm-api`
   * vCPU 0.25 / Memory 0.5 GB is enough to start
   * **Port:** `4000`
   * **Environment variables** (Console → *Add environment variable*; for secrets choose *Reference from Secrets Manager* if you prefer):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `MONGODB_URI` | the Atlas string from step 1 |
| `JWT_ACCESS_SECRET` | output of `openssl rand -hex 48` |
| `JWT_REFRESH_SECRET` | another `openssl rand -hex 48` |
| `CORS_ORIGINS` | `https://main.xxxxxxxx.amplifyapp.com` (add your custom domain later, comma separated) |
| `PUBLIC_API_URL` | the App Runner URL, e.g. `https://abc123.ap-south-1.awsapprunner.com` (fill in after first deploy, then redeploy) |
| `STORAGE_DRIVER` | `s3` |
| `AWS_REGION` | `ap-south-1` |
| `S3_BUCKET` | your bucket name |
| `SEED_ORG_NAME`, `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` | your first admin (used once by the seed) |
| `LOG_LEVEL` | `info` |

4. **Security** → *Instance role* → `LeadCrmAppRunnerInstanceRole`.
5. **Health check** → *HTTP*, path `/health`.
6. Create. After a few minutes you get a default domain like `https://abc123.ap-south-1.awsapprunner.com`. Open `/health` — you should see `{"status":"ok","db":"up"}`.

### 5a. Run the seed once

The seed creates the organisation, the admin login, default permission templates, pipeline stages/statuses/sources, the loan-specific lead fields and message templates. Run it **from your laptop** against the production database (the container has no shell by default):

```bash
cd lead-crm-backend
cp .env.example .env         # fill MONGODB_URI (Atlas) + SEED_* values + JWT secrets (any value works for seeding)
npm ci && npm run seed       # add "-- --demo" to also create demo teams/users/leads
```

Then log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and change the password from the user menu.

---

## 6. Frontend on Amplify Hosting

1. Amplify → **Create new app** → *Host web app* → GitHub → pick `lead-crm-frontend`, branch `main`.
2. Amplify detects `amplify.yml` in the repo (build: `npm ci && npm run build`, output `dist`).
3. **Environment variables** → add `VITE_API_URL` = your App Runner URL (no trailing slash). Vite bakes it in at build time, so re-run the build if you change it.
4. **Rewrites and redirects** (App settings) — required for React Router deep links. Add one rule:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

5. Save and deploy. Your app is at `https://main.xxxxxxxx.amplifyapp.com`.
6. Go back to App Runner and set `CORS_ORIGINS` to this URL; update the S3 CORS `AllowedOrigins` too.

### Custom domain (optional)

Amplify → *Domain management* → add `crm.yourcompany.com` (Route 53 or your DNS). For the API, App Runner → *Custom domains* → `api.yourcompany.com`, then update `VITE_API_URL`, `PUBLIC_API_URL` and `CORS_ORIGINS`.

---

## 7. Going live checklist

- [ ] Admin password changed; `mustChangePassword` on for every user you create
- [ ] `JWT_*_SECRET` are long random strings and not committed anywhere
- [ ] Atlas backups enabled (M10+) or a scheduled `mongodump`
- [ ] S3 bucket blocks public access; CORS origins limited to your domains
- [ ] App Runner auto-scaling: min 1 instance (imports run in-process; scale to 2+ only after moving imports to a worker or ensuring rules use Mongo's atomic cursor — they already do)
- [ ] CloudWatch: App Runner streams stdout logs; create an alarm on 5xx count
- [ ] Rate limits (`RATE_LIMIT_*`) suit your team size

---

## Alternatives

* **Lightsail / a single EC2 VM** (~$5–10/mo): `docker compose up -d` with the API image + Caddy for HTTPS; use `STORAGE_DRIVER=local` with an attached disk if you don't want S3. Cheapest, but you patch the box.
* **ECS Fargate + ALB**: more knobs (VPC, private Atlas peering, WAF); choose when compliance requires a fixed network boundary.
* **Render / Railway / Fly.io** for the API and **Vercel / Netlify** for the SPA: the same Dockerfile and `dist/` output work unchanged if you are not tied to AWS.

## Local development

```bash
# terminal 1 — API
cd lead-crm-backend && cp .env.example .env && npm install && npm run seed -- --demo && npm run dev
# terminal 2 — UI
cd lead-crm-frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :4000)
```
Requires a local MongoDB (`brew install mongodb-community` / `docker run -p 27017:27017 mongo:7`).
