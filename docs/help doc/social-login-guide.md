# Social Login Integration Guide (Google + Apple)

> **Endpoint:** `POST /api/v1/auth/social-login`
> **Pattern:** Mobile SDK login -> ID Token -> Server verification -> JWT issue

---

## Part 1: Backend Developer — Ki Ki Korte Hobe

### ⚠️ Step 0: Right Google Cloud Project Select Koro (MOST IMPORTANT)

**Ei step miss korle shob debugging time waste hobe.** Shobar age Google Cloud project-er issue resolve koro.

#### The Cardinal Rule

> **OAuth Client IDs, Firebase project (`google-services.json`), ar backend-er Firebase service account — tinoi-ta SAME Google Cloud project-e thakte hobe.**

Firebase project = Google Cloud project (1:1 mapping). Mismatch hole:
- Flutter login -> project A-r token pay
- Server verify kore project B-r audience-e -> 401 mismatch
- Push notifications project C-e pathay -> silently fail
- Error: `PlatformException(sign_in_failed, ApiException: 10)` (DEVELOPER_ERROR)

#### Decision Checklist (before touching ANY console)

Ekta kaj shuru korar age ei question-gulo answer koro:

1. **Client-er already kono Google Cloud / Firebase project ache?**
   - Hile — **shei project use koro**, notun banaio na
   - Project ID confirm koro client theke

2. **Flutter app-e `google-services.json` already ache?**
   - `flutter_project/android/app/google-services.json` khole dekho:
   ```json
   {
     "project_info": {
       "project_id": "smrt-scrub",         // <-- ei project use korte hobe
       "project_number": "344458357764"
     }
   }
   ```
   - Ei `project_id` = tomar "official" project. OAuth Client IDs **ei project-e** banate hobe, tomar personal ba dev-er personal project-e na.

3. **Who owns the Google Cloud billing?**
   - Production-e client-er account-e thaka uchit — dev chole gele / account suspend hole login bondho hobe na
   - Dev-er personal project use korle eta business risk

#### Common Project Mismatch Scenarios

| Scenario | Symptom | Fix |
|----------|---------|-----|
| Dev personal GCP project-e Client IDs banaichhe, Flutter app client-er Firebase project use kore | `ApiException: 10` on login | Client's Firebase-linked GCP project-e Client IDs recreate koro |
| Multiple Firebase projects (old test + new prod) shathe shathe run korche | FCM tokens register hoy kintu push fail | Ek-ta project-e standardize koro, both FCM ar service account same project-theke |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` project A-r, `google-services.json` project B-r | Push notifications fail silently | Service account regenerate koro same project theke je project-er `google-services.json` app-e ache |

#### Verify Project Alignment (1 min check)

```
Flutter app's google-services.json:  project_id = X
Server .env FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 (decoded): project_id = X
Google Cloud Console → Credentials:  OAuth Client IDs live in project X
```

**Tinoi-ta X hoa lagbe.** Alada hole issue.

```bash
# Service account-er project_id check (Windows PowerShell):
$base64 = (Get-Content .env | Select-String "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64").ToString().Split('=')[1]
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64)) | ConvertFrom-Json | Select project_id
```

---

#### 🔗 Quick Links Cheat Sheet (replace `{PROJECT_ID}` with your project id)

Google Cloud Console / Firebase / Apple — je je page-e jete hobe, shob direct link ek jaygay. Example project id = `smrt-scrub`.

**Google Cloud Console (OAuth Client IDs, APIs):**

| Page | Direct URL |
|------|------------|
| Credentials (OAuth Client IDs list) | `https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}` |
| OAuth consent screen | `https://console.cloud.google.com/apis/credentials/consent?project={PROJECT_ID}` |
| Project dashboard | `https://console.cloud.google.com/home/dashboard?project={PROJECT_ID}` |
| API Library (enable APIs) | `https://console.cloud.google.com/apis/library?project={PROJECT_ID}` |

**Firebase Console (Push, SHA-1, Service Accounts):**

| Page | Direct URL |
|------|------------|
| Project settings (General) | `https://console.firebase.google.com/project/{PROJECT_ID}/settings/general` |
| Service accounts (generate JSON for backend) | `https://console.firebase.google.com/project/{PROJECT_ID}/settings/serviceaccounts/adminsdk` |
| Cloud Messaging (FCM) | `https://console.firebase.google.com/project/{PROJECT_ID}/notification` |
| Authentication | `https://console.firebase.google.com/project/{PROJECT_ID}/authentication/users` |
| App settings (for SHA-1, download google-services.json) | `https://console.firebase.google.com/project/{PROJECT_ID}/settings/general/` then scroll to "Your apps" |

**Apple Developer Portal (Sign In with Apple):**

| Page | Direct URL |
|------|------------|
| Identifiers list | `https://developer.apple.com/account/resources/identifiers/list` |
| Certificates list | `https://developer.apple.com/account/resources/certificates/list` |
| Services IDs (for web/Android Apple Sign In) | `https://developer.apple.com/account/resources/identifiers/list/serviceId` |
| Keys (for Apple Sign In private key `.p8`) | `https://developer.apple.com/account/resources/authkeys/list` |

**Bookmarkable for tbsosick (`smrt-scrub` project):**

```
GCP Credentials:    https://console.cloud.google.com/apis/credentials?project=smrt-scrub
GCP Consent Screen: https://console.cloud.google.com/apis/credentials/consent?project=smrt-scrub
Firebase Settings:  https://console.firebase.google.com/project/smrt-scrub/settings/general
Service Accounts:   https://console.firebase.google.com/project/smrt-scrub/settings/serviceaccounts/adminsdk
```

> **Tip:** ei link-gula browser bookmark kore rakho — prottek bar `gcp -> project select -> APIs & Services -> Credentials` navigate kora time waste.

---

### Step 1: Google Cloud Console Setup

> **Shurur age Step 0 pore nao.** Kon project-e kaj korche sure hoye eikhane ashba.

Google-te iOS, Android, Web — prottekar **alada client ID** thake. Eita important — mismatch hole verify fail korbe.

**Overview — 3 ta OAuth Client ID create korte hobe (shob same project-e):**

| # | Application Type | Required Info | Env Var | Purpose |
|---|-----------------|---------------|---------|---------|
| 1 | **iOS** | Bundle ID (e.g. `com.yourcompany.app`) | `GOOGLE_CLIENT_ID_IOS` | iOS native login initialization |
| 2 | **Android** | Package name + SHA-1 fingerprint | `GOOGLE_CLIENT_ID_ANDROID` | Android native login initialization |
| 3 | **Web application** ⭐ | (name only, no redirect if mobile-only) | `GOOGLE_CLIENT_ID_WEB` | **Token audience (`serverClientId`) — REQUIRED** |

> ⭐ **Web Client ID MANDATORY, even for mobile-only apps.** Flutter-e `google_sign_in` plugin-er `serverClientId` parameter-e **Web Client ID** pass kora hoy (iOS/Android ID na). Eita-i idToken-er `aud` claim hobe — server ei value diye verify korbe. Most devs mistake kore iOS/Android Client ID `serverClientId`-e dey, which causes audience mismatch.

> **Important:** iOS ar Android-er client ID-te kono **client secret nai** — Google mobile clients-ke "public client" mone kore, tai secret generate kore na. Shudhu client ID lagbe.

> **How it works:** Server-e `verifyIdToken()` call korar shomoy audience-e tin-tai array hishebe pass hoy. Token-er `aud` claim jodi ANY ektar shathe match kore, verify pass hoy. Practice-e `serverClientId` (Web Client ID) use hole token-er `aud` = Web Client ID — so shei ta primarily hit hoy.

---

#### Prerequisite: OAuth Consent Screen Configure (ekbar matro)

Client ID create korar **age** ei step ta korte **must**, na hole "Create Credentials" button disable thakbe.

**Direct link:** `https://console.cloud.google.com/apis/credentials/consent?project={PROJECT_ID}`
(example: `https://console.cloud.google.com/apis/credentials/consent?project=smrt-scrub`)

**Manual navigation:**

1. [Google Cloud Console](https://console.cloud.google.com/) -> tomar project select koro (ba notun create koro)
2. Left sidebar: **APIs & Services** -> **OAuth consent screen**
3. **Get Started** button click koro
4. **App Information**:
   - App name: `YourAppName`
   - User support email: tomar email
5. **Audience**: `External` select koro (normal users-er jonne)
6. **Contact Information**: developer email
7. **Agree** to policy -> **Create**

> Production-e jaoyar age **Publishing Status** "Testing" theke "In Production" korte hobe (Audience tab theke). Testing mode-e shudhu add kora test users login korte parbe.

---

#### 1.1: iOS Client ID Create

**Direct link:** `https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}`

**Manual navigation:**

1. Left sidebar: **APIs & Services** -> **Credentials**
2. Top-e **+ Create Credentials** -> **OAuth client ID**
3. **Application type**: `iOS` select koro
4. **Name**: `iOS Client` (ja khushi)
5. **Bundle ID**: tomar iOS app-er Bundle ID (app developer theke nao)
   - Example: `com.yourcompany.yourapp`
   - Xcode-e: Project -> General -> Bundle Identifier
6. **App Store ID** (optional, publish korar por dibe)
7. **Team ID** (optional, Apple Developer account theke)
8. **Create** click koro

> Copy: **Client ID** (ends with `.apps.googleusercontent.com`) -> `.env`-e `GOOGLE_CLIENT_ID_IOS`-e paste koro.
> **Client secret nai** — eita normal, mobile client "public" bole Google secret dey na.

---

#### 1.2: Android Client ID Create

**Direct link:** `https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}`

> **Alternative (recommended for Firebase projects):** Android app-ke Firebase-e register korar shomoy Firebase automatic ekta Android OAuth Client banay. Firebase -> Project Settings -> Android app-e SHA-1 add korle `google-services.json`-e automatically incorporate hoy.
> Firebase Console Android setup: `https://console.firebase.google.com/project/{PROJECT_ID}/settings/general`

**Age SHA-1 fingerprint lagbe** — app developer theke nao, othoba niche-r command diye generate koro:

**Debug SHA-1** (development):

Windows PowerShell (tested, kaj kore):
```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

macOS / Linux:
```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

> **Windows-e `~/.android/` kaj kore na** — PowerShell tilde expand kore na. `$env:USERPROFILE` use korte hobe (e.g. `C:\Users\YourName\.android\debug.keystore`).
> **`keytool` not found?** -> `JAVA_HOME\bin` PATH-e add koro, othoba Android Studio-er bundled JDK use koro: `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`.

**Release SHA-1** (production APK) — tomar release keystore-er actual path dao:
```powershell
keytool -list -v -alias your-key-alias -keystore "C:\path\to\release.keystore"
```

Output-e `SHA1:` line-er pashe je fingerprint ache — copy koro (format: `AA:BB:CC:...`).

**Example output:**
```
SHA1:   E1:91:D1:6C:72:58:69:6C:73:BA:6C:13:0D:A4:6F:AF:3C:42:E1:5D
SHA256: 45:6F:16:BF:6F:67:F3:2A:D6:A4:20:88:C9:D3:EE:21:92:3D:00:50:18:DF:5F:21:CF:47:59:47:5B:A5:5E:3E
```
> Google Cloud Console-e **SHA-1** value ta paste korte hobe (SHA-256 na).

**Tarpor — Manual navigation:**

1. Left sidebar: **APIs & Services** -> **Credentials**
2. Top-e **+ Create Credentials** -> **OAuth client ID**
3. **Application type**: `Android`
4. **Name**: `Android Client`
5. **Package name**: `com.yourcompany.yourapp` (app-er `build.gradle` theke)
6. **SHA-1 certificate fingerprint**: upor-er command theke paoya value paste koro
7. **Create**

> Copy: **Client ID** -> `GOOGLE_CLIENT_ID_ANDROID`.
> **Debug ar Release SHA-1 alada** — dui tar jonne dui ta Android Client ID banano best practice, othoba ek Client ID-te dui SHA-1 add koro (Edit -> Add fingerprint).

---

#### 1.2.1: SHA-1 Ta Ashol-e Ki? (Concept Explained)

> Ei section pore rakha — porer bar setup korar shomoy confusion hole ei part dekhle clear hobe.

**Apartment Building Analogy:**

Google Server = apartment building. Shudhu authorized resident-ke dhuktai dite chao.

| Real World | OAuth World |
|-----------|-------------|
| Guard | Google verification system |
| Resident | Tomar Android app |
| ID Card (naam) | Package name (e.g. `com.yourcompany.app`) |
| Fingerprint | SHA-1 |

Guard-er rule: *"Naam + Fingerprint **dui-tai** match korle dhukte dibo. Shudhu naam nokol kora jay, fingerprint jay na."*

---

**Keno SHA-1 lage?**

Android app-e **client secret rakha jay na** — karon APK basically ekta zip, decompile kore keo secret churi kore nite pare. Tai Google "mobile = public client" dhore, secret dey na.

Kintu tahole security risk: attacker jodi tomar Client ID jane (APK theke easily paoya jay), nokol app banaiye token nite parbe?

**SHA-1 exactly ei problem solve kore:**
- Tomar app-er signing keystore theke ekta unique hash generate hoy -> SHA-1
- Google Cloud Console-e tumi register koro: "ei SHA-1 + package name er app-i shudhu amar Client ID use korte parbe"
- Attacker Client ID janleo, **tomar keystore chhara** app sign korte parbe na -> alada SHA-1 -> Google reject korbe

---

**Ek Machine, Onek App — Kivabe Distinguish Hoy?**

Dhoro Android dev-er laptop-e 5 ta app:

| App | Package Name | Debug SHA-1 |
|-----|--------------|-------------|
| tbsosick | `com.tbsosick.app` | `E1:91:D1:6C:...` |
| food-app | `com.mdbay.foodapp` | `E1:91:D1:6C:...` |
| chat-app | `com.mdbay.chatapp` | `E1:91:D1:6C:...` |

SHA-1 **shob app-er same** — karon ek machine-e ekta-i debug keystore (`~/.android/debug.keystore`), shob app sei same file diye sign hoy.

**Distinguisher:** `package_name + SHA-1` **combination** — ei pair-i unique identifier. Google match kore dui tai.

---

**Team-e Onek Developer Thakle?**

Prottek developer-er debug keystore **alada** (alada laptop, alada Android Studio install). Tai ek app-er jonne multiple debug SHA-1 ashbe:

| Developer | Debug SHA-1 |
|-----------|-------------|
| mdbay | `E1:91:D1:6C:...` |
| karim | `AA:BB:CC:DD:...` |
| rahim | `77:88:99:00:...` |

**Solution:** Google Cloud Console-e ekta Android Client ID-te **multiple SHA-1 add kora jay**:

```
Android Client ID: tbsosick
  Package: com.tbsosick.app
  SHA-1 fingerprints:
    ├── E1:91:D1:6C:... (mdbay debug)
    ├── AA:BB:CC:DD:... (karim debug)
    ├── 77:88:99:00:... (rahim debug)
    └── 12:34:56:78:... (release — production)
```

**Notun dev team-e ashle:** tar debug SHA-1 nao, Client ID-e "Add fingerprint" diye add koro. Na hole oi dev-er build-e login fail korbe.

---

**Debug vs Release Keystore:**

| Keystore | Kothay thake | SHA-1 |
|----------|-------------|-------|
| **Debug** | Prottek dev-er laptop-e alada (Android Studio auto-generate) | Prottek-er alada |
| **Release** | Shudhu ek jaygay — secret file, Git-e commit hoy na | App-er jonne ekta-i |

**Minimum 2 ta SHA-1 lagbe production-er age:**
1. Dev team-er prottek-er debug SHA-1 (development/testing)
2. Release keystore-er SHA-1 (Play Store build)

---

**Ke Command Chalabe?**

| Scenario | Ke Chalabe |
|----------|-----------|
| Tomar backend dev-er laptop-e keystore nai | **Android dev chalabe**, tomake SHA-1 share korbe |
| Tumi nije Android app build korcho | Tumi nije chalabe |
| Release SHA-1 lagbe | Jar kache release keystore ache (lead dev/DevOps) |

**Backend dev-er kaj:** Android dev theke value nao -> Google Cloud Console-e paste koro. Bas.

---

**tl;dr:**

1. **SHA-1** = tomar app-er "digital fingerprint" (keystore file theke ashe)
2. **App identity = package_name + SHA-1** combination
3. **Ek machine-er shob app-e same debug SHA-1**, but package name alada -> unique
4. **Ek Client ID-e multiple SHA-1 add kora jay** (team members + release mile)
5. **Debug keystore = dev laptop-e auto-generate**, **Release keystore = team-er ek shared secret file**

---

#### 1.3: Web Client ID Create (MANDATORY — serverClientId audience)

> **Mobile-only app holeo ei ta LAGBE.** Ei value-i Flutter `serverClientId`-e jabe ar idToken-er `aud` claim hobe. Skip korle login fail korbe (401 audience mismatch / `ApiException: 10`).

**Direct link:** `https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}`

**Manual navigation:**

1. Left sidebar: **APIs & Services** -> **Credentials**
2. Top-e **+ Create Credentials** -> **OAuth client ID**
3. **Application type**: `Web application`
4. **Name**: `Server Audience` (ba `Mobile Backend` — ja intent clear kore)
5. **Authorized JavaScript origins**: mobile-only hole **khali rakhle o cholbe** (production web frontend thakle `https://yourdomain.com` + `http://localhost:3000` dao)
6. **Authorized redirect URIs**: mobile-only hole **khali rakhle o cholbe** (web redirect flow use korle actual URI dao)
7. **Create**

> Copy: **Client ID** -> `GOOGLE_CLIENT_ID_WEB`.
> Web client-e **Client Secret thake** — kintu `social-login` endpoint ID token verify kore, secret lagbe na. Shudhu Client ID use koro.

**Why this Client ID is special:**
- Flutter `google_sign_in(serverClientId: '<THIS>')` parameter-e ei value bosabe
- Google je idToken dibe, tar `aud` claim hobe ei Client ID
- Server `.env`-er `GOOGLE_CLIENT_ID_WEB`-e **exact same value** thakte hobe
- iOS/Android Client IDs primarily native login initialization-er jonne — ID token audience er shathe shopark nai

---

#### 1.3.1: Web Client ID — Deep Dive (Concept Explained)

> Ei section pore rakha. Porer bar "keno Web Client ID lage, mobile-only app-e keno?" confusion hole ei part dekhle pura OAuth flow clear hoye jabe.

**"Web application" Client ID Originally Ki?**

Google-er OAuth 2.0 system-e 4 rokom Client ID thake — app kothay chole sheta onujayi:

| Application Type | Kothay Chole | Example |
|------------------|--------------|---------|
| **iOS** | iPhone/iPad native app | tomar Flutter-er iOS build |
| **Android** | Android native app | tomar Flutter-er Android build |
| **Web application** | Browser-e chola web app | gmail.com, admin dashboard |
| **Desktop** | Windows/Mac native | Google Drive desktop client |

**"Web application" Client ID originally** — browser-based HTML/JS app-er jonne, user login kore redirect URI-te back ashe with auth code flow.

---

**Kintu Mobile App-e Keno Lage? (The Twist)**

Mobile app to web na — tahole Web Client ID keno?

Ei khane **Audience (`aud`) concept** ashe. OIDC specification bole:

> "ID token issue korar shomoy token-er `aud` claim-e bolte hobe ei token **kar jonne**."

Analogy:
- **Token** = letter
- **`aud` claim** = envelope-e written receiver address
- **Server verify kore:** "address = amar?" ✅ / ❌

---

**Mobile Flow-e `aud` Ki Hoy? — 3 Option**

Flutter `google_sign_in` use korle, Google-ke bolte hoy: "user-ke login koriye ID token dao."

**Google-er internal question:** *"token-er `aud` ki bosabo?"*

| Option | Result | Suitable? |
|--------|--------|-----------|
| A: `aud` = iOS Client ID (default if no serverClientId) | Token "iOS app-er jonne" | ❌ Server-e verify hobe na — audience mismatch |
| B: `aud` = Android Client ID (default on Android) | Token "Android app-er jonne" | ❌ Same problem |
| C: `aud` = Web Client ID (if serverClientId passed) ⭐ | Token "server-er jonne" | ✅ Server verify korte pare |

---

**Keno Web Client ID-i "Server's Identity"?**

Bit confusing, but logical:

| App Component | Physical Form | OAuth Identity | Client ID Type |
|---------------|--------------|----------------|----------------|
| iPhone-e chola Flutter UI | Mobile | iOS Client ID | iOS |
| Samsung-e chola Flutter UI | Mobile | Android Client ID | Android |
| **tomar Node.js Express backend** | **Server** | **Web Client ID** | **Web application** |

**Keno "Web"?** Karon Google-er view-te server = web entity. Server HTTPS-e chole, web protocol use kore. Naming convention — "Web Client ID" mane actually tomar backend server-er identity.

---

**Complete Flow Diagram**

```
┌──────────────┐                  ┌──────────┐                  ┌─────────┐
│ Flutter App  │                  │  Google  │                  │ Server  │
│ (iOS/Android)│                  │          │                  │  (Web)  │
└──────┬───────┘                  └─────┬────┘                  └────┬────┘
       │                                │                             │
       │  1. signIn(serverClientId:    │                             │
       │     "Web Client ID")          │                             │
       │ ─────────────────────────────>│                             │
       │                                │                             │
       │                                │  Google: "OK, audience =    │
       │                                │  Web Client ID. Token issue"│
       │                                │                             │
       │  2. idToken: { aud: "Web ID"} │                             │
       │ <─────────────────────────────│                             │
       │                                │                             │
       │  3. POST /social-login                                      │
       │     { idToken, nonce, ... }                                 │
       │ ───────────────────────────────────────────────────────────>│
       │                                │                             │
       │                                │  4. Server: "token.aud ==   │
       │                                │     GOOGLE_CLIENT_ID_WEB? ✅"│
       │                                │                             │
       │  5. { accessToken, refreshToken }                           │
       │ <───────────────────────────────────────────────────────────│
```

---

**iOS ar Android Client ID-er Role Tahole?**

Valid question — shudhu Web Client ID dile hoto na?

**Answer: Dui-tar alada alada kaj ache.**

| Client ID | Role |
|-----------|------|
| **iOS Client ID** | iOS native login sheet launch korar shomoy Google verify kore "kon iOS app ei request korche" (Bundle ID diye) |
| **Android Client ID** | Android login popup-e Google verify: package name + SHA-1 = legit app kina |
| **Web Client ID** | idToken-er `aud` claim — "ei token kon server-er jonne" |

**Building Analogy:**
- iOS/Android Client ID = **gate pass** (guard-e dekhao kon app-er jonne)
- Web Client ID = **letter-er address** (letter kar jonne)

Dui-tai lagbe — dhokar shomoy gate pass, porar shomoy address.

---

**Amazon E-commerce Analogy (Simple)**

- **iOS Client ID** = iPhone-er Amazon app identity — "ohh iPhone app theke order"
- **Android Client ID** = Samsung-er Amazon app identity
- **Web Client ID** = Amazon warehouse server identity — "order amar warehouse-e ashe"

User iPhone app-e order kore -> Amazon verifies iOS app ✅ -> generates receipt with "**Deliver to: Warehouse**" (Web Client ID) -> warehouse server receives receipt -> fulfill kore.

**Mobile Client ID = request initiator. Web Client ID = receipt recipient.**

---

**Tomar Server Code-e Reality**

```ts
// auth.service.ts
googleClient.verifyIdToken({
  idToken,
  audience: [
    config.google.clientIdIos,     // iOS Client ID — rarely matches
    config.google.clientIdAndroid, // Android Client ID — rarely matches
    config.google.clientIdWeb,     // ⭐ Web Client ID — practically always matches
  ],
});
```

Token-er `aud` jekono ek-ta-r shathe match hole pass. `serverClientId` = Web Client ID use korle, practically **Web Client ID-i hit kore**.

---

**TL;DR — One Line**

> **Web Application Client ID = tomar server-er "email address"**. Google idToken-e ei address bosaye, server verify kore "ha eta amar-jonne." Mobile app-e "Web" Client ID use kora eta simply Google-er naming convention — actually eta tomar backend-er identity.

---

#### 1.3.2: Testing vs Production — Full Deployment Guide

> Ek-tai Web Client ID testing ar production dui phase-e kaj kore. Alada banate hobe na. Shudhu administrative change:

| Phase | Consent Screen Status | Origins/Redirects | Client ID |
|-------|----------------------|-------------------|-----------|
| **Testing** (dev) | "Testing" mode | Empty (mobile-only) | Same |
| **Production** (live) | "In production" mode | Empty (ba domains jodi web add koro) | Same |

---

**PART 1: Testing Phase (Ekhoni Korbe)**

**Step A: OAuth Consent Screen Configure — Testing Mode**

Direct link: `https://console.cloud.google.com/apis/credentials/consent?project={PROJECT_ID}`

Page-e giye dekho:
- "Get Started" button dekhle -> never configured, first-time setup koro
- "Audience / Branding / Data Access" tabs dekhle -> already configured

**First-time configure:**

| Field | Testing-e Ki Dibe |
|-------|-------------------|
| App name | `TBSOSICK` (ba ja client pref) |
| User support email | tomar / client-er email |
| **Audience** | ⭐ `External` (otherwise shudhu Google Workspace users login parbe) |
| Developer contact email | tomar email |

Agree policy -> **Create** -> Consent screen auto **"Testing"** mode-e start.

**Step B: Test Users Add (Testing Mode Mandatory)**

Testing mode-e **shudhu whitelist users login korte parbe**. Na add korle `403 access_denied` silently.

1. Consent screen page -> **"Audience"** tab
2. **"Test users"** -> **+ ADD USERS**
3. Add everyone who'll test:
   ```
   you@gmail.com
   bayzid@gmail.com
   qa@client-company.com
   client@company.com
   ```
4. **Save**

**Step C: Web Client ID Create** — already upor-e covered (Section 1.3). Ekta-i banabe, testing + production dui-jaygay kaj korbe.

**Step D: Testing Verify**

1. `npm run dev` — server clean start
2. Flutter app-e login try koro **whitelisted test user diye**
3. Success hole:
   ```
   Server log: [auth.service] verifyIdToken success, aud=<Web Client ID>
   Response: { accessToken, refreshToken }
   ```

**Testing Error Matrix:**

| Error | Cause | Fix |
|-------|-------|-----|
| 403 access_denied | User not in test_users list | Consent screen test users-e add koro |
| ApiException: 10 | Package/SHA-1 mismatch | Troubleshooting section check (earlier in guide) |
| 401 Invalid Google ID token | `_WEB` value mismatch | `.env` + Flutter serverClientId same Client ID kina verify |

---

**PART 2: Production Launch Phase**

**Backend/Flutter code kichui change na.** Only 3 ta administrative change:

**Change 1: Consent Screen -> "In Production" Publish**

Direct link: `https://console.cloud.google.com/apis/credentials/consent?project={PROJECT_ID}`

1. **Audience** tab open
2. Current status: **"Testing"**
3. **"Publish App"** button click
4. Popup: *"Your app will be available to everyone with a Google Account"* -> **Confirm**
5. Status change: **"In production"**

**Effect:** Test users whitelist restriction removed. Jei kono Google user-e login korte parbe.

> **"Sensitive scopes" use korle verification lagbe** — but tumi only `openid`, `email`, `profile` use korcho (default social login scopes), so **NO verification needed**. Publish instant hoy.

**Change 2: Release Keystore SHA-1 Add**

Production APK release keystore diye sign — debug theke alada SHA-1.

1. Release SHA-1 generate (Windows PowerShell):
   ```powershell
   keytool -list -v -alias <release-alias> -keystore "path\to\release.keystore"
   ```
2. Firebase Console -> Project Settings -> Android app -> **Add fingerprint** -> release SHA-1 paste
3. **`google-services.json` re-download** -> Flutter project-e replace
4. Release APK build -> ei APK login korbe

> **Debug SHA-1 rekhe dao** — dev team-er debug APK o login korte parbe (multiple SHA-1 co-exist korte pare).

**Change 3: Play Store App Signing SHA-1 (IMPORTANT — Commonly Missed)**

"App Signing by Google Play" use korle, Google nijer key-te re-sign kore. Tai Play Store install-kora APK-er SHA-1 alada — tomar release keystore SHA-1 na.

1. Play Console -> tomar app -> **Setup** -> **App integrity**
2. **App signing key certificate** section -> SHA-1 copy koro
3. Firebase-e ei SHA-1 add koro
4. `google-services.json` re-download -> Flutter project-e replace

> **Ei step miss korle:** Play Store-theke-install-kora app-e login fail, kintu sideload APK login kaj kore. Confusing, commonly missed.

---

**Summary Checklist**

**Dev/Testing Phase:**
```
✅ OAuth Consent Screen — Testing mode
✅ Test users whitelist add (dev team-er Gmails)
✅ Web Client ID created, .env + Flutter code updated
✅ Debug SHA-1 added (each dev-er)
✅ Flutter debug APK-e login kore
```

**Production Launch:**
```
✅ Same Web Client ID (change na)
✅ Consent Screen → "Publish App" (Testing → In Production)
✅ Release keystore SHA-1 added
✅ Play Store App Signing SHA-1 added (Play Store use korle)
✅ google-services.json re-downloaded + committed
✅ Release APK build & test
```

---

**Multi-Client-ID Scenarios (Future)**

| Scenario | Ek Client ID Enough? | Note |
|----------|---------------------|------|
| Mobile-only app (tbsosick current) | ✅ Ha | Ek audience dorkar |
| Mobile + web frontend add hole | ⚠️ Same project-e 2nd Web Client banaite paro | Frontend-er alada origins/redirects thakbe |
| Staging + Production alada environment | ⚠️ Alada Client IDs recommended | Staging leak hole prod safe |

**Ekhon:** ek-ta-i banate hobe. Future-e staging lagle separate Web Client safest.

---

**Timeline (Practical)**

**Today (testing phase):**
- [ ] Consent screen `External` + test users add
- [ ] Web Client ID create — origins/redirects empty
- [ ] `.env` update + Flutter code update
- [ ] Dev team login test

**Launch-er 1 week age:**
- [ ] Release keystore plan
- [ ] Play Store-e app uploaded, App Signing SHA-1 paoa
- [ ] Firebase-e release + Play Store SHA-1 add
- [ ] Final google-services.json committed

**Launch day:**
- [ ] Consent screen "Publish App" click
- [ ] Release APK Play Store-e submit
- [ ] Post-launch: first 24h server logs monitor

---

#### Common Issues

| Problem | Solution |
|---------|----------|
| "OAuth client was deleted" | Consent screen publish korcho kina check koro |
| Android login fail, "invalid_client" | SHA-1 ar package name match korche kina verify koro |
| iOS login fail | Bundle ID exact match lagbe (case-sensitive) |
| Token `aud` mismatch | App je Client ID diye login korche, sheta `.env`-e ache kina check koro |
| Release build fail but debug works | Release SHA-1 add korcho kina check koro |

### Step 2: Apple Developer Portal Setup

Apple-er jonne **shudhu Bundle ID lagbe** as client ID. Alada Services ID lagbe na (sheta web-only flow-er jonne).

**Direct link:** https://developer.apple.com/account/resources/identifiers/list

**Manual navigation:**

1. [Apple Developer Portal](https://developer.apple.com/account) jao
2. **Certificates, Identifiers & Services** -> **Identifiers**
3. App ID select koro (Bundle ID, e.g. `com.tbsosick.smrtscrub`)
4. **Sign In with Apple** capability **enable** koro (checkbox tick)
5. Save koro

> **Bundle ID vs Services ID:**
> - **Bundle ID** = native iOS app-er identifier (e.g. `com.yourcompany.app`) — **mobile app eita use kore**
> - **Services ID** = web-based Sign In with Apple-er jonne — **tomar dorkar nai** (karon mobile-only app)
>
> Token-er `aud` claim = Bundle ID. Backend-e same Bundle ID dite hobe `APPLE_CLIENT_ID` env-e.

### Step 3: `.env` File Setup

```env
# ---- Social Login ----

# Google (prottek platform-er alada client ID — Google Cloud Console theke)
GOOGLE_CLIENT_ID_IOS=xxxxxxxxxxxx-ios.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=xxxxxxxxxxxx-android.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=xxxxxxxxxxxx-web.apps.googleusercontent.com

# Apple (Bundle ID — Apple Developer Portal theke)
APPLE_CLIENT_ID=com.yourcompany.yourapp
```

> Jodi kono platform nai (e.g. web nai), sei env var empty rakhle cholbe — server automatically filter kore fele.

### Step 4: Verify Setup

Server start koro (`npm run dev`) ar check koro kono error nai. Then app developer-ke bolte hobe test korte.

---

## Part 2: App Developer-ke Ki Provide Korte Hobe

Tumi backend developer hishebe app developer-ke ei jinishgulo dibe:

### 1. API Endpoint Details

```
POST /api/v1/auth/social-login
Content-Type: application/json
```

### 2. Request Body Schema

```json
{
  "provider": "google | apple",
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "nonce": "aB3xK9mP2qR7...",
  "deviceToken": "fcm-token-here",
  "platform": "ios | android",
  "appVersion": "1.2.0"
}
```

| Field         | Required    | Type   | Notes                                      |
| ------------- | ----------- | ------ | ------------------------------------------ |
| `provider`    | Yes         | string | `"google"` or `"apple"`                    |
| `idToken`     | Yes         | string | Provider SDK theke paowa ID token          |
| `nonce`       | Apple: **Yes** · Google: Recommended | string | Replay attack prevention — min 32 chars. Mandatory for Apple; optional for Google (Flutter plugin limitation). |
| `deviceToken` | No          | string | FCM push notification token                |
| `platform`    | No          | string | `"ios"` / `"android"` / `"web"`            |
| `appVersion`  | No          | string | App version tracking                       |

### 3. Response Format

**Success (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged in successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

> `refreshToken` httpOnly cookie-teo set hoy.

**Error Responses:**

| Status | When                                                                 |
| ------ | -------------------------------------------------------------------- |
| `400`  | Invalid body / nonce < 32 chars / Apple login without nonce / new Apple user missing email |
| `401`  | Invalid/expired token / nonce mismatch / Google email not verified   |
| `403`  | Account deleted or restricted                                        |
| `409`  | Email already in use by another account (sign in first and link)     |
| `429`  | Too many requests — rate-limited (10/min per IP)                     |

### 4. Google Client IDs (App Developer-ke dite hobe)

**Tin ta-i dao** — misuse avoid korar jonne purpose explain koro:

| Platform | Client ID env var | Where to Use in Flutter |
|----------|-------------------|-------------------------|
| iOS | `GOOGLE_CLIENT_ID_IOS` | `GoogleSignIn(clientId: '<iOS ID>')` — iOS-only |
| Android | `GOOGLE_CLIENT_ID_ANDROID` | Not used directly in Dart — `google-services.json` + SHA-1 handle it |
| **Web ⭐** | `GOOGLE_CLIENT_ID_WEB` | `GoogleSignIn(serverClientId: '<Web ID>')` — **BOTH iOS and Android use this** |

> ⭐ `serverClientId` = Web Client ID **always**. Eita commonest bug. App dev-ke explicitly janao.
>
> Confirm korao: **tin-tai Client ID same Google Cloud project theke ashche** (`google-services.json`-er `project_id`-er shathe match).

### 5. Apple Bundle ID

App developer already janbe — eta app-eroi Bundle ID. Flutter `sign_in_with_apple` package iOS-e native, Android-e web flow use kore.

---

## Part 3: Flutter App Developer er Step-by-Step Guide

> **Stack:** ei project-er mobile app **Flutter/Dart** — tai ei section-e shudhu Flutter code ar packages dewa hoyeche. Native Swift/Kotlin reference na lage.

### Nonce System (Replay Attack Prevention)

Prottek login request-e ekta unique random string generate korte hobe:

```
1. rawNonce = random string generate koro (32+ chars)
2. Apple: SHA256(rawNonce) -> Apple SDK-te pathao | Google: rawNonce directly SDK-te pathao
3. SDK theke idToken pao
4. Server-e pathao: idToken + rawNonce (original, hashed na)
5. Server verify kore match hocche kina
```

### Flow Diagram

```
+---------------+         +----------------+         +---------------+
|  Mobile App   |         | Google/Apple   |         |  Server       |
+-------+-------+         +-------+--------+         +-------+-------+
        |                         |                           |
        |  1. Generate rawNonce   |                           |
        |                         |                           |
        |  2. Login via SDK       |                           |
        |  Apple: sha256(nonce)   |                           |
        |  Google: raw nonce      |                           |
        | ----------------------> |                           |
        |                         |                           |
        |  3. Receive idToken     |                           |
        | <---------------------- |                           |
        |                         |                           |
        |  4. POST /social-login                              |
        |     { idToken, nonce: rawNonce, provider }          |
        | --------------------------------------------------> |
        |                         |                           |
        |                         |  5. Verify token          |
        |                         |     Verify nonce          |
        |                         |     Find/create user      |
        |                         |                           |
        |  6. { accessToken, refreshToken }                   |
        | <-------------------------------------------------- |
```

---

### `idToken` ar `nonce` — Kothay Theke Ashe?

Ei dui ta field API-te pathate hoy. Duita completely alada jinish — confusion na hoye kintu:

#### 🔑 `idToken` — SDK Auto-Generate Kore

User "Sign in with Google/Apple" button tap korle **Flutter plugin** login complete korar por tomake `idToken` return kore. **Tumi ei token banao na**, plugin-i deye.

| Provider | Flutter Plugin | pubspec.yaml | Code Path |
|----------|---------------|--------------|-----------|
| **Google** | [`google_sign_in`](https://pub.dev/packages/google_sign_in) | `google_sign_in: ^6.2.1` | `GoogleSignIn().signIn()` -> `account.authentication` -> **`auth.idToken`** |
| **Apple** | [`sign_in_with_apple`](https://pub.dev/packages/sign_in_with_apple) | `sign_in_with_apple: ^6.1.0` | `SignInWithApple.getAppleIDCredential(...)` -> **`credential.identityToken`** |

**Under the hood** (jodi kotohono janaar ichcha hoy):
- **`google_sign_in` plugin** internally iOS-e [GoogleSignIn SDK (iOS)](https://developers.google.com/identity/sign-in/ios) use kore, Android-e [Google Identity Services](https://developers.google.com/identity) use kore — native code-e call dey
- **`sign_in_with_apple` plugin** iOS-e native [AuthenticationServices framework](https://developer.apple.com/documentation/authenticationservices) (Apple-er built-in) use kore, Android-e web OAuth flow use kore (karon Apple native Android SDK dey na)

> `idToken` ekta **cryptographically signed JWT** — Google/Apple-er private key diye sign kora. Server-er kache public key ache, sheta diye verify kore. Tumi ei token change korle server fail dibe.

#### 🎲 `nonce` — App-e Nije Generate Koro

Prottek login request-e **notun random string**. Replay attack prevent kore — ekbar use hoye geshe token attacker jodi churi kore, aboar use korte parbe na karon nonce different.

**Flutter code:**
```dart
import 'dart:math';
String rawNonce = List.generate(
  32,
  (_) => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._'
      [Random.secure().nextInt(64)],
).join();
```

**Google vs Apple (important):**

| Provider | Nonce Format SDK-e pathano | Nonce Format Server-e pathano |
|----------|----------------------------|--------------------------------|
| **Google** | `rawNonce` directly | `rawNonce` (raw) |
| **Apple** | `sha256(rawNonce)` — hash | `rawNonce` (raw) — server hash kore compare |

**Mane:** Apple-ke hash-kora nonce dao, but server-e **always raw nonce** pathao. Server nije hash kore match korbe.

---

### Flutter (Dart) Implementation

#### Dependencies (`pubspec.yaml`)

```yaml
dependencies:
  google_sign_in: ^6.2.1        # Google login (iOS + Android)
  sign_in_with_apple: ^6.1.0    # Apple login (iOS native + Android web fallback)
  crypto: ^3.0.3                # SHA-256 for Apple nonce hashing
  http: ^1.2.0                  # API call
  firebase_messaging: ^15.0.0   # FCM device token (optional)
```

```bash
flutter pub get
```

> Apple gets strict nonce protection via `sign_in_with_apple`. Google uses
> the token's signature + audience + `email_verified` checks; nonce is
> skipped on server side because `google_sign_in` can't pass it. If you
> need strict Google nonce, see **"Optional: Strict Google Nonce"** at the
> bottom of this section.

#### Platform-Specific Setup

**iOS** (`ios/Runner/Info.plist`) — Google Sign In-er jonne URL scheme add koro:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- Reversed iOS Client ID -->
      <!-- Original: 247970361242-r52rrf6f0o467dkm0gs48eidlb6b6u2h.apps.googleusercontent.com -->
      <!-- Reversed: com.googleusercontent.apps.247970361242-r52rrf6f0o467dkm0gs48eidlb6b6u2h -->
      <string>com.googleusercontent.apps.247970361242-r52rrf6f0o467dkm0gs48eidlb6b6u2h</string>
    </array>
  </dict>
</array>
```

**Apple Sign In-er jonne** `ios/Runner/Runner.entitlements`:
```xml
<key>com.apple.developer.applesignin</key>
<array>
  <string>Default</string>
</array>
```
Xcode-e **Signing & Capabilities** tab theke **"Sign in with Apple"** add korle auto-generate hoy.

**Android** — `google_sign_in` auto kaj kore, shudhu Google Cloud Console-e SHA-1 + package name registered thaka lagbe (already done). Alada config lagbe na.

#### Nonce Helper (`lib/utils/nonce_helper.dart`)

```dart
import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

String generateNonce([int length = 32]) {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  final random = Random.secure();
  return List.generate(length, (_) => charset[random.nextInt(charset.length)]).join();
}

String sha256OfString(String input) {
  final bytes = utf8.encode(input);
  return sha256.convert(bytes).toString();
}
```

#### Google Sign In (No Nonce — Pragmatic Default)

```dart
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;

Future<void> signInWithGoogle() async {
  final googleSignIn = GoogleSignIn(
    // iOS: iOS Client ID (native login initialization)
    clientId: Platform.isIOS
        ? '<GOOGLE_CLIENT_ID_IOS>.apps.googleusercontent.com'
        : null,  // Android auto-picks from google-services.json
    // ⚠️ serverClientId = WEB Client ID (NOT iOS/Android).
    //    This becomes the `aud` claim of the idToken and MUST match
    //    GOOGLE_CLIENT_ID_WEB on the server. Using iOS/Android Client ID
    //    here is the #1 source of `ApiException: 10` errors.
    serverClientId: '<GOOGLE_CLIENT_ID_WEB>.apps.googleusercontent.com',
  );

  final account = await googleSignIn.signIn();
  if (account == null) return;  // user cancelled

  final auth = await account.authentication;
  final idToken = auth.idToken;
  if (idToken == null) return;

  final fcmToken = await FirebaseMessaging.instance.getToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/v1/auth/social-login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'provider': 'google',
      'idToken': idToken,
      // 'nonce' omitted — google_sign_in doesn't support it. Server does
      //   signature/audience/email_verified checks instead.
      'deviceToken': fcmToken,
      'platform': Platform.isIOS ? 'ios' : 'android',
    }),
  );

  final data = jsonDecode(response.body);
  // Save data['data']['accessToken'] and data['data']['refreshToken']
}
```

#### Apple Sign In

```dart
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;

Future<void> signInWithApple() async {
  final rawNonce = generateNonce();
  final hashedNonce = sha256OfString(rawNonce);

  final credential = await SignInWithApple.getAppleIDCredential(
    scopes: [
      AppleIDAuthorizationScopes.email,
      AppleIDAuthorizationScopes.name,
    ],
    nonce: hashedNonce,  // Apple gets the HASH
    // Android-er jonne webAuthenticationOptions lagbe — iOS-e lagbe na
    webAuthenticationOptions: Platform.isAndroid
        ? WebAuthenticationOptions(
            clientId: 'com.tbsosick.smrtscrub.service',  // Services ID (Android only)
            redirectUri: Uri.parse('https://your-backend.com/api/v1/auth/apple/callback'),
          )
        : null,
  );

  final idToken = credential.identityToken;
  if (idToken == null) return;

  final fcmToken = await FirebaseMessaging.instance.getToken();

  final response = await http.post(
    Uri.parse('${baseUrl}/api/v1/auth/social-login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'provider': 'apple',
      'idToken': idToken,
      'nonce': rawNonce,                               // RAW nonce — server hashes & compares
      'deviceToken': fcmToken,
      'platform': Platform.isIOS ? 'ios' : 'android',
    }),
  );

  final data = jsonDecode(response.body);
  // Save tokens
}
```

> **Android-e Apple Sign In:** Apple native Android SDK dey na — web flow lagbe. Ekta **Services ID** banate hobe Apple Developer Portal-e (Bundle ID chhara alada), ar redirect URI configure korte hobe. iOS-only app hole ei part skip.

#### Optional: Strict Google Nonce (advanced)

Skip this unless your threat model requires defense-in-depth against
long-window token replay beyond what HTTPS + rate limiting already cover.
`google_sign_in` alone won't work — pick one of these:

**Option A — `flutter_appauth` + OIDC discovery (Dart-only)**

Adds a custom OAuth2 flow that can pass `nonce` directly to Google.

```yaml
dependencies:
  flutter_appauth: ^6.0.0
```

```dart
import 'package:flutter_appauth/flutter_appauth.dart';

final rawNonce = generateNonce();
final appAuth = FlutterAppAuth();
final result = await appAuth.authorizeAndExchangeCode(
  AuthorizationTokenRequest(
    '247970361242-r52rrf6f0o467dkm0gs48eidlb6b6u2h.apps.googleusercontent.com',
    'com.googleusercontent.apps.247970361242-r52rrf6f0o467dkm0gs48eidlb6b6u2h:/oauth2redirect',
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    scopes: ['openid', 'email', 'profile'],
    additionalParameters: {'nonce': rawNonce},
  ),
);

// result.idToken now contains the nonce claim; send rawNonce to server
```

Tradeoff: lose the native Google sign-in sheet UX; you get a browser-based
OAuth2 redirect flow instead.

**Option B — Platform channels to native SDKs**

Write a MethodChannel bridge:
- iOS: `GIDSignIn.sharedInstance.signIn(withPresenting:, nonce:)`
- Android: `GetSignInWithGoogleOption.Builder(clientId).setNonce(rawNonce).build()` via Credential Manager

Tradeoff: ~100 lines of platform code on each side; keeps native UX.

Either way, send the raw nonce in the `nonce` field of the `/social-login`
request — the server already verifies it when present.

---

#### Common Flutter Issues

| Problem | Solution |
|---------|----------|
| iOS-e "GIDSignIn not configured" | `Info.plist`-e reversed client ID URL scheme add korcho kina check koro |
| Android-e Google login fail silently | Google Cloud Console-e SHA-1 + package name register korcho kina verify koro |
| Apple Sign In button dekhay na | Platform check lagbe: `Platform.isIOS` (ba `SignInWithApple.isAvailable()`) |
| iOS build fail: "missing entitlement" | Xcode-e "Sign in with Apple" capability add koro |
| `idToken` null ashe | User cancel korle null ashe — handle koro |

---

## Part 4: Important Notes

### Apple Email Behavior (CRITICAL)

- Apple **shudhu prothombar** email + name dey
- Porer login-e email thakteo pare, na-o thakte pare
- `sub` (Apple user ID) **shobshomoy** ashe — server eta diye user match kore
- User email hide korle Apple ekta **private relay email** dey: `xyz@privaterelay.appleid.com`
- **Action:** App developer-ke bolte hobe — prothom login-e email + name save koro locally, karon Apple ar dibe na

### Google Multiple Client IDs & `serverClientId`

- iOS, Android, Web prottekar jonne **alada** OAuth client ID thake
- Server-e **tin-tai** env var dite hobe
- `verifyIdToken()` array accept kore — token-er `aud` jodi ANY ektar shathe match kore, pass
- **Flutter-e `serverClientId` = Web Client ID** (iOS/Android na). Eita commonest bug — devs iOS Client ID diye dey, login fails silently (or returns `ApiException: 10`)

### SHA-1 Fingerprint: Per-Developer Reality Check

- **Prottek dev-er debug keystore alada** (Android Studio auto-generates, machine-specific)
- Ek dev-er debug SHA-1 Firebase/GCP-e add korle onno dev-er APK login korte parbe na
- **Solution:** Team-e shob dev-er debug SHA-1 add koro Firebase Android app settings-e
  - Firebase Console -> Project Settings -> Android app -> "Add fingerprint"
  - SHA-1 add korar por **updated `google-services.json` download kore Flutter project-e replace koro** (otherwise changes pick up na)
- **Release SHA-1** (Play Store signed APK) alada — CI/CD ba lead dev-er kache thake, production-er age oitao add korte hobe
- `google-services.json` file-e purono kono dev-er SHA-1 thakleo problem na — jototto gulo SHA-1 registered thake, ttotogulo machine login korte parbe

### Nonce Policy (Apple Strict, Google Pragmatic)

**Apple — nonce REQUIRED:**
- Client MUST generate rawNonce (min 32 chars), pass `sha256(rawNonce)` to `sign_in_with_apple` SDK, and send the raw nonce to the server
- Server rejects with 400 if missing, 401 if hash mismatch
- Apple officially mandates nonce-based replay protection

**Google — nonce OPTIONAL (Flutter plugin limitation):**
- Mainstream `google_sign_in` Flutter plugin doesn't expose a nonce parameter, so the server doesn't force it
- If the client *does* send nonce (via `flutter_appauth`, platform channels, or a custom flow), the server validates it — mismatched nonce still returns 401
- Without nonce, Google login still has: signature verification, audience check, short expiration, email_verified check, HTTPS, rate limiting — same posture Firebase Auth and Auth0 ship with by default
- Teams that want strict Google nonce should use `flutter_appauth` with OIDC discovery (see "Optional: Strict Google Nonce" below in this guide)

### Account Linking Policy

- Social login with a Google/Apple account whose email matches an existing
  **password-based** account returns **409 Conflict**
- App must instruct the user: "Sign in with your password first, then link
  your Google/Apple account from account settings"
- Prevents attacker who controls a provider account with the same email
  from hijacking local accounts (OWASP account-linking guidance)
- Once a user manually links the provider from within an authenticated
  session, subsequent social logins find the linked provider ID and sign
  them straight in

### Rate Limiting

- `/social-login`, `/login`: **10 requests / minute / IP**
- `/forgot-password`, `/verify-otp`, `/reset-password`: **5 requests / minute / IP**
- 429 response when exceeded — app should surface a friendly retry message

### New User Creation via Social Login

- Social login-e new user create hole `country` ar `phone` required na (pore profile complete korbe)
- `password` o required na (OAuth user)
- User automatically `verified: true` hoy (provider already email verify korche)

### Troubleshooting — Common Errors

#### `PlatformException(sign_in_failed, ApiException: 10)` — Android Google Login

"DEVELOPER_ERROR" — config ar code mismatch. Check in this order:

| # | Check | Fix |
|---|-------|-----|
| 1 | **Project mismatch:** `google-services.json`-er `project_id` = OAuth Client IDs-er project? | Tin-ta place (Flutter json, server .env Client IDs, Firebase service account) shob same project-e rakho |
| 2 | **`serverClientId` = Web Client ID?** iOS ba Android Client ID diye dile ei error ashe | Flutter `GoogleSignIn(serverClientId: '<WEB-CLIENT-ID>')` |
| 3 | **Current dev-er debug SHA-1 added?** Other dev-er SHA-1 thakleo kaj korbe na | **Direct link:** `https://console.firebase.google.com/project/{PROJECT_ID}/settings/general` · **Manual:** Firebase Console -> Project Settings -> General tab -> scroll to "Your apps" -> Android app -> Add fingerprint -> download new `google-services.json` -> replace in Flutter project -> `flutter clean && flutter run` |
| 4 | **Package name match?** Flutter `build.gradle`-er `applicationId` = Google Cloud Console Android Client-er package name | Exact match required (case-sensitive) |
| 5 | **Updated `google-services.json` downloaded?** SHA-1 add korar por re-download required | `android/app/google-services.json` replace + `flutter clean && flutter run` |

#### `401 Invalid Google ID token` — Server Response

| Cause | Fix |
|-------|-----|
| `aud` claim mismatch — token audience != `GOOGLE_CLIENT_ID_WEB` | Server `.env`-e `GOOGLE_CLIENT_ID_WEB` = app-er `serverClientId` value, same project |
| Token expired | App re-login — tokens ~1hr valid |
| Token from different project | Step 0 project alignment re-check |

#### `409 Conflict: Email already in use`

- Same email-e password-based account already ache
- User ke: password diye login koro, settings theke social link koro
- Expected behavior — security feature (OWASP account linking)

#### Push Notifications Silently Fail After Login Works

- FCM token `google-services.json`-er project-e register hoy
- Backend `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` jodi alada project-er hoy, push reject hobe
- Fix: Service account regenerate same project theke -> base64 encode -> `.env` update
  - **Direct link:** `https://console.firebase.google.com/project/{PROJECT_ID}/settings/serviceaccounts/adminsdk`
  - **Manual steps:** Firebase Console -> Project Settings -> Service accounts tab -> "Generate new private key" -> JSON file download -> base64 encode -> `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` replace in `.env`

#### Apple Sign In Fails on Second Login (Email Missing)

- Apple shudhu first login-e email + name dey, subsequent logins-e not
- Server `sub` (provider ID) diye match kore — already handled in code
- App-e: first login-er email + name locally save koro (future use-er jonne)

#### `400 Nonce is required for Apple sign-in`

- Apple-er jonne nonce strictly required (production policy)
- Flutter `sign_in_with_apple`-e `nonce: sha256(rawNonce)` pass koro
- Server-e raw `rawNonce` pathao (hash na)

---

### Backend Key Files

| File                                       | Purpose                                     |
| ------------------------------------------ | ------------------------------------------- |
| `src/app/modules/auth/auth.service.ts`     | `socialLoginToDB` — token verification + user logic |
| `src/app/modules/auth/auth.controller.ts`  | `socialLogin` — HTTP handler                |
| `src/app/modules/auth/auth.route.ts`       | `POST /social-login` route                  |
| `src/app/modules/auth/auth.validation.ts`  | Zod schema validation                       |
| `src/app/modules/user/user.model.ts`       | `googleId`, `appleId` fields                |
| `src/config/index.ts`                      | `google.clientId*`, `apple_client_id`       |

### References

- [Google Backend Auth — Official Docs](https://developers.google.com/identity/sign-in/android/backend-auth)
- [Google ID Token Verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Apple Sign In — Getting Started](https://developer.apple.com/sign-in-with-apple/get-started/)
- [Apple Configuring Environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- [Firebase Apple Auth + Nonce](https://firebase.google.com/docs/auth/ios/apple)
- [apple-signin-auth npm](https://www.npmjs.com/package/apple-signin-auth)
