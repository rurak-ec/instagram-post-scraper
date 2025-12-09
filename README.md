# 📘 Instagram Scraper API - Developer Guide

> **Project Status**: Active & Stable 🚀
> **Tech Stack**: NestJS, Playwright, Docker, TypeScript

[🇪🇸 Leer en Español](./README.es.md)

Robust REST API for Instagram scraping, specifically designed for developers who need high availability and ban evasion through an intelligent account rotation system.

---

## ⚡ Quick Start

If you're a developer and want to get the project running NOW, follow these steps:

### 1. Critical Requirements ⚠️

For this scraper to work reliably and avoid blocks ("soft bans" or "rate limits"), you need dedicated Instagram accounts.

| Requirement          | Quantity        | Note                                                                    |
| -------------------- | --------------- | ----------------------------------------------------------------------- |
| **Absolute Minimum** | 2 Accounts      | Works, but if one fails (challenge/lock), the system degrades to 50%.   |
| **Recommended**      | **5+ Accounts** | **Optimal Stability**. Allows wide rotation and account "rest" periods. |
| **Unlimited**        | N Accounts      | The system supports as many accounts as you add to `.env`.              |

> [!WARNING]
> **⚠️ Risks of Automated Behavior Detection**
>
> Instagram actively detects and restricts automated activity. You may receive warnings like "We detected unusual activity" or "Suspicious login attempt". Here are best practices to minimize risks:

#### 🛡️ Account Recommendations

| Recommendation                  | Why It Matters                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Use aged accounts**           | Accounts created recently (< 6 months) are more likely to trigger detection. Use accounts that have been active for a while. |
| **Start gradually**             | Don't start with heavy scraping. Begin with 2-3 requests per account per hour and increase progressively over days/weeks.    |
| **Let accounts "rest"**         | Rotate frequently so each account has cool-down periods. The system does this automatically.                                 |
| **More accounts = safer**       | Having 5-10+ accounts distributes the load and reduces individual account risk.                                              |
| **Don't use your main account** | Always use secondary/dedicated accounts. If one gets restricted, you don't lose your personal profile.                       |

#### 📈 Progressive Usage Strategy

```
Week 1:  🐢 Light usage (2-3 scrapes/account/hour)
Week 2:  🚶 Moderate usage (5-8 scrapes/account/hour)
Week 3+: 🏃 Normal usage (10-15 scrapes/account/hour)
```

> [!TIP]
> **If an account gets flagged**: Don't panic. The system automatically rotates to healthy accounts. Log into the affected account manually, complete any verification challenge, and it will recover. Having more accounts means one flagged account doesn't stop your operation.

### 2. Environment Setup

```bash
# Copy the template
cp .env.example .env

# EDIT the .env (Critical)
# Add your accounts in format: USER:PASS
IG_ACCOUNT_1=my_bot_1:password123
IG_ACCOUNT_2=my_bot_2:password123
IG_ACCOUNT_3=my_bot_3:password123
IG_ACCOUNT_4=my_bot_4:password123
IG_ACCOUNT_5=my_bot_5:password123
```

---

## 🛠️ Workflows

We clearly differentiate between **Development** (where you want to SEE what happens) and **Production** (where you want performance and silence).

### 🐛 Development Mode (Visual Debugging)

In this mode, the browser opens visually (`headless: false`). You see exactly how the bot logs into Instagram and navigates.

**Configuration in `.env`:**

```properties
NODE_ENV=development
HEADLESS=false       <-- KEY: This opens the browser
VERBOSE_LOGS=true    <-- KEY: Detailed console logs
```

**Command:**

```bash
yarn dev
```

> The server will start at `http://localhost:3000`. You'll see Chromium open automatically.

---

### 🚀 Production Mode (Docker / Server)

This is "Fire & Forget" mode. Everything runs in Docker containers, without GUI, optimized for Linux/Cloud servers. Sessions PERSIST even if you restart the container.

**Configuration (Automatic in Docker):**
No need to touch `.env` for this. The `docker-compose.yml` forces:

- `HEADLESS=true`
- `NODE_ENV=production`

**Deployment Commands:**

```bash
# 1. Start services (Auto-build)
docker compose up -d

# 2. View real-time logs (Essential for monitoring scraping)
docker compose logs -f

# 3. Basic Administration
docker compose down         # Stop everything
docker compose restart      # Restart services (fast)
```

### 🛠️ Maintenance Commands

**1. Rebuild (If you change code):**

```bash
docker compose up -d --build
```

**2. View Logs (Essential for debugging):**

```bash
docker compose logs -f --tail 100
```

**3. Restart only the Scraper:**

```bash
docker compose restart instagram-post-scraper
```

**4. Check container status:**

```bash
docker compose ps
```

**5. Rebuild EVERYTHING from scratch (Complete Reset):**

```bash
# Stop and remove containers, networks, and volumes
docker compose down -v

# Remove the image
docker rmi instagram-post-scraper:latest

# Clean Docker build cache
docker builder prune -af

# Rebuild without cache and start
docker compose build --no-cache && docker compose up -d
```

> ⚠️ **Warning**: This will delete all saved sessions. You'll need to log in again on all Instagram accounts.

> **Persistence**: Docker volumes ensure you **DON'T** have to log in every time.
>
> - `sessions/`: Stores cookies/localStorage for each bot.
> - `data/`: Stores rotation statistics.

---

### 🌐 Docker Networking (Important)

This project uses **`network_mode: host`** instead of Docker virtual networks. This is **required** because:

1. **Chromium requires real internet access** to connect to Instagram
2. Docker bridge networks can block external browser connectivity
3. Simplifies communication from other containers

**How to connect from other Docker containers:**

| From                               | Connection URL                                      |
| ---------------------------------- | --------------------------------------------------- |
| Host (your machine)                | `http://localhost:3000`                             |
| Another container (Linux)          | `http://172.17.0.1:3000` or `http://<HOST-IP>:3000` |
| Another container (Docker Desktop) | `http://host.docker.internal:3000`                  |

**Example: Consume from another docker-compose.yml:**

```yaml
services:
  my-service:
    image: my-app:latest
    environment:
      # On Linux, use Docker's gateway IP
      - SCRAPER_API_URL=http://172.17.0.1:3000
      # On Docker Desktop (Mac/Windows)
      # - SCRAPER_API_URL=http://host.docker.internal:3000
```

> **Note**: To get the correct host IP on Linux, run: `docker network inspect bridge | grep Gateway`

---

## 📡 Usage Examples

### 1. Simple cURL (Quick Test)

Scrape posts from `@natgeo` using a random available account:

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "username": "natgeo"
  }'
```

### 2. TypeScript / Node.js (Integration)

```typescript
// Your API client
async function getInstagramPosts(targetUsername: string) {
  try {
    const response = await fetch(
      "http://localhost:3000/instagram-post-scraper",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: targetUsername,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Batch processed: ${data.totalProfiles} profiles`);
      data.results.forEach((result) => {
        if (result.success) {
          console.log(`\n📌 Profile: ${result.username}`);
          console.log(`🤖 Scraped with: ${result.scrapedWith}`);
          console.log(`📦 Posts: ${result.postsCount}`);
        } else {
          console.error(
            `❌ Profile ${result.username} failed: ${result.error}`
          );
        }
      });
      return data.results;
    } else {
      console.error("❌ Error in scraper:", data);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
  }
}
```

### 3. Batch Mode (Parallel Multi-Scrape)

**⚡ New: Simultaneous Processing**

Batch mode now executes all scrapes **in parallel** using multiple tabs in the same browser. This means:

- All profiles are scraped **simultaneously** (not sequentially)
- Uses the **same Instagram account** for the entire batch
- **Emulated Focus** enabled on each tab to avoid inactive tab issues
- Maximum **5 profiles** per batch

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "usernames": ["natgeo", "nasa", "tesla"]
  }'
```

> **Note**: The complete batch takes approximately as long as the slowest profile, not the sum of all.

### 4. Filter by Date (`createdAt`)

You can specify a date to get only posts published AFTER that UNIX timestamp.

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "username": "natgeo",
    "createdAt": 1765158474
  }'
```

### 4.1 Individual Date Filter (Batch Mode)

In batch mode, use `createdAtMap` to specify a different `createdAt` for each profile:

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "usernames": ["natgeo", "nasa", "tesla"],
    "createdAtMap": {
      "natgeo": 1765158474,
      "nasa": 1765000000,
      "tesla": 1764900000
    }
  }'
```

> **Note**: `createdAtMap` takes precedence over global `createdAt`. If a profile is not in the map, the global `createdAt` is used.

### 5. Check Account Status (`GET /accounts/status`)

Query the current status of all configured accounts: whether they're active, last success/failure, and failure reason.

```bash
curl http://localhost:3000/accounts/status
```

**Response:**

```json
{
  "totalAccounts": 3,
  "activeAccounts": 2,
  "inactiveAccounts": 1,
  "accounts": [
    {
      "username": "bot_1",
      "isActive": true,
      "lastSuccess": "2025-12-07T04:45:00.000Z",
      "lastFailure": null,
      "failureReason": null,
      "consecutiveFailures": 0
    },
    {
      "username": "bot_2",
      "isActive": false,
      "lastSuccess": "2025-12-06T12:00:00.000Z",
      "lastFailure": "2025-12-07T02:30:00.000Z",
      "failureReason": "Session invalid (login required)",
      "consecutiveFailures": 3
    }
  ]
}
```

> **Note**: An account is marked as `inactive` after 3 consecutive failures. The automatic repair system will attempt to restore it in the background.

---

## 🏗️ Project Architecture

```
instagram-post-scraper/
├── src/
│   ├── modules/
│   │   ├── accounts/   # 🧠 BRAIN: Manages rotation and account health
│   │   └── scraper/    # 🤖 BODY: Controls Playwright and data extraction
├── sessions/           # 💾 MEMORY: Persistent cookies and sessions (GitIgnored)
└── data/               # 📊 STATS: Account usage history
```

### How Rotation Works ("The Secret Sauce")

1. **Incoming Request**: User asks to scrape `@leomessi`.
2. **Account Manager**:
   - Looks at your account pool (e.g., 5 bots).
   - Filters those that are "Healthy" (not recently blocked).
   - Selects the **Least Used** (Lowest Usage Score) or Round-Robin.
3. **Session Check**:
   - Has valid cookies on disk? -> **Reuse** (Instant load ⚡).
   - Doesn't have them? -> **Login** (Only the first time).
4. **Scraping**: Navigates, extracts JSON, closes context.
5. **Cool-down**: Releases the bot for the next task.

---

## 📦 Data Structure (JSON Response)

What you get at the end:

```json
{
  "success": true,
  "totalProfiles": 1,
  "successfulProfiles": 1,
  "failedProfiles": 0,
  "results": [
    {
      "success": true,
      "username": "natgeo",
      "postsCount": 1,
      "scrapedWith": "my_bot_3",
      "scrapedAt": 1765159000,
      "posts": [
        {
          "id": "3123456789",
          "shortcode": "CzJ8...",
          "type": "feed",
          "text": "Post caption...",
          "likes": 15400,
          "comments": 230,
          "createdAt": 1765158474,
          "media": [
            {
              "type": "image",
              "url": "https://instagram.fna... (Temporary CDN URL)",
              "width": 1080,
              "height": 1080
            }
          ],
          "permalink": "https://instagram.com/p/CzJ8..."
        }
      ]
    }
  ]
}
```

---

## 🚨 Common Troubleshooting

**Q: Error `listen EADDRINUSE: address already in use :::3000`**  
A: Another process (probably a zombie node instance) is using the port.
Solution: `kill -9 $(lsof -t -i:3000)`

**Q: My accounts get blocked (Challenge Required)**  
A: You're scraping too fast with too few accounts.
Solution:

1. Add more accounts to `.env`.
2. Increase delay between requests.
3. Docker automatically restarts bad sessions, but you need "calm" in requests.

**Q: I don't see the browser in `yarn dev`**  
A: Check that `HEADLESS=false` is set in your `.env`.

**Q: Error `net::ERR_INTERNET_DISCONNECTED` in Docker**  
A: Chromium inside the container can't access the internet.  
Solution: Make sure to use `network_mode: host` in your `docker-compose.yml`. Docker bridge networks can block browser connectivity.

**Q: API returns 0 posts with `graphqlCaptured: false`**  
A: This warning means Instagram's GraphQL API did not respond to the scraper. This typically indicates:

| Possible Cause          | Solution                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Account restriction** | Log into the account manually on a browser, complete any verification challenge. Check `/accounts/status` endpoint. |
| **Too many requests**   | The account is rate-limited. Wait 15-30 minutes before retrying. Add more accounts to distribute load.              |
| **Session expired**     | Restart the scraper with `docker compose restart instagram-post-scraper`. Sessions will be re-validated.            |
| **Instagram blocking**  | Try using aged accounts (6+ months old). Use the progressive usage strategy described above.                        |

> [!NOTE]
> If `graphqlCaptured: true` but `posts: []`, the profile genuinely has no posts (or all posts were filtered by `createdAt`). This is normal behavior.

---

**Happy Scraping!** 🕷️
