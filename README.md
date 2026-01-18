# (Translated English UI from main fork, no other changes made)

# SillyTavernchat v1.15.0

An enhanced version based on official SillyTavern **1.15.0**, continuing to deliver enterprise-grade features such as user management, system monitoring, forums, and announcement management.

## English UI translation status

Public-facing templates have been translated to English. Remaining work is tracked in `translation-checklist.md`.

## 🆕 Latest updates (V1.15.0)

### Official 1.15.0 highlights

#### Highlights
- First preview of Macros 2.0: a full macro system overhaul with nested macros and stable evaluation order.
- Recommend enabling “Experimental Macro Engine” in User Settings → Chat/Message Processing to try the new engine.
- Legacy macro replacement will no longer be updated and will be removed in the future.

#### Breaking changes
- `{{pick}}` macros are incompatible between the old and new macro engines; switching engines changes existing pick results.
- Because group chat metadata handling changed, existing group chat files are migrated automatically; post-upgrade group chats are incompatible with older versions.

#### Backend
- Chutes: new Chat Completion source.
- NanoGPT: more samplers exposed in the UI.
- llama.cpp: model selection and multi-swipe generation support.
- OpenAI, Google, Claude, Z.AI model lists synced.
- Electron Hub: Claude model caching support.
- OpenRouter: Gemini and Claude system prompt caching support.
- Gemini: thought signatures support for applicable models.
- Ollama: extract reasoning content from replies.

#### Improvements
- Experimental macro engine: nested macros, stable evaluation order, and improved autocomplete.
- Group chat metadata format aligned with regular chats.
- “Manage chat files” dialog adds a backup browser.
- Prompt Manager: main prompt can be set to absolute position.
- Three media-inline toggles merged into one setting.
- New “verbosity” control for supported Chat Completion sources.
- Gemini source adds image resolution and aspect ratio settings.
- Improved CharX resource extraction on character import.
- Backgrounds: new UI tab and upload chat backgrounds.
- Optional toggle to exclude reasoning blocks from smooth streaming output.
- start.sh on Linux/MacOS no longer uses nvm to manage Node.js versions.

#### STscript
- New `/and` command.
- New `/message-role` and `/message-name` commands.
- `/api-url` supports VertexAI region configuration.

#### Extensions
- Speech recognition: Chutes, MistralAI, Z.AI, ElevenLabs, Groq as STT sources.
- Image generation: Chutes, Z.AI, OpenRouter, RunPod Comfy as inference sources.
- TTS: unified ElevenLabs and other API key handling.
- Image captioning: Z.AI (general/code) captions for video files.
- Web search: Z.AI as a search source.
- Gallery: video uploads and playback support.

## Demo

**https://st.zkjd.me**

**https://ai.cao.baby**

## 🌟 Core features

### 📊 Based on SillyTavern 1.15.0
- ✅ Supports all original SillyTavern features
- ✅ Integrates the latest AI model and API support
- ✅ MiniMax TTS
- ✅ Moonshot, Fireworks, CometAPI and more API sources
- ✅ Enhanced Story String wrapping sequences
- ✅ Improved extension system and UI/UX
- ? Admin-configurable default template for new users (settings, presets, character cards, etc.)

## 🚀 Enhanced features

### 👥 User management system
- **User registration and login**: full authentication system
- **Email verification registration**: supports email code registration (V1.13.12)
  - Sends a verification code during registration
  - Code expires after 5 minutes
  - Automatically binds the email to the user account
  - If email service is disabled, registration works without verification
- **Email password recovery**: recover password via email (V1.13.12)
  - If a user has a bound email and email service is enabled, the recovery code is emailed
  - If no email is bound or email service is disabled, the recovery code is printed to the server console
  - Recovery code expires after 5 minutes
- **Password reset**
- **Session management**: secure session control
- **User data isolation**: each user has separate storage
- **Storage monitoring**: show per-user storage usage
- **User email info**: profile displays bound email (V1.13.12)
- **OAuth third-party login/registration** (V1.13.12)
  - **Supported providers**: GitHub, Discord, Linux.do
  - **One-click login**: no password required
  - **Auto-sync info**: sync real username, avatar, and email
  - **Smart avatar management**: download on first login, refresh on each login
  - **Flexible login modes** (V1.13.12)
    - OAuth-only users (no password): OAuth login only
    - OAuth users with password: OAuth or username/password
  - **Password setup**: OAuth users can set a password in profile settings
  - **Invitations integration**: OAuth signups require an invite code if enabled
  - **Dynamic callback URL**: auto-adapts to reverse proxy/SSL
  - **Security**: state parameter to prevent CSRF
- **Backup cleanup**: admins can clear backups to free space
  - Per-user backup cleanup
  - Batch cleanup for all users
  - Storage analysis by file type
  - Safe cleanup: keeps chats and important data
- **Delete long-inactive user data**: admins can filter by inactivity (1 week/half-month/1 month/2 months), set a max storage threshold (MiB), preview and delete user data, backups, chats, etc. (V1.13.11) Updated 2025/11/07 with more filters

### 🎫 Invitation code system
- **Invitation generation**: admins can generate codes
- **Registration restriction**: limit signup via codes
- **Expiry management**: set expiration time
- **Usage stats**: track code usage
- **Enable/disable**: edit `enableInvitationCodes: true/false` in `config.yaml`

### 🎫 Invitation system additions (V1.13.10)
- **Time-based code generation**: one-day codes expire one day after registration, etc.
- **Expired renewals**: expired users are logged out and can renew with a new code
- **Admin renewal link**: admins can configure a renewal link on the login page
- **Renewal**: users can renew with invite codes
- **Renewal code management**: admins generate and track renewal codes
- **Defaults**: if invitations are off, accounts are permanent; if on, accounts are time-limited
- **Duration types**: 7 durations (1 day/1 week/1 month/1 quarter/half-year/1 year/permanent)

### 📢 Announcements system
- **Main site announcements**: built-in announcements after login
  - Create, edit, delete
  - Enable/disable status
  - Category management (tutorials, discussions, official, etc.)
- **Login page announcements**: separate login-page announcement system (V1.13.12)
  - Display at top of login page
  - Support multiple announcements
  - Types: info/warning/success/error
  - Theme-compatible design
  - Managed from admin panel
  - Public visibility (no login required)
- **Admin features**:
  - Unified management for main and login announcements
  - Type switching
  - Real-time enable/disable
  - Created/updated timestamps

### 📈 System monitoring
- **Real-time load**: CPU, memory, disk usage
- **User activity stats**: message counts, active users
- **Historical records**: performance history
- **Visual charts**: clear data visualization
- **Performance alerts**: resource warnings

### 💬 Forum community
- **Post publishing**: rich text editor
- **Categories/tags**
- **Comments and replies**
- **User interactions**: likes, favorites, sharing
- **Content moderation**: admins can delete/close forum posts
- **Enable/disable**: edit `enableForum: true/false` in `config.yaml`

### 🎭 Public character library
- **Character sharing**
- **Browsing**
- **Search and filter**
- **Download and import**
- **Ratings and comments**
- **Enable/disable**: edit `enablePublicCharacters: true/false` in `config.yaml`

### 📧 Email service (V1.13.12)
- **SMTP mail** via nodemailer
- **Admin email config**
  - SMTP host/port
  - SSL/TLS
  - From address and name
  - Test email sending
- **Supported providers**
  - Gmail (app password required)
  - QQ Mail (authorization code required)
  - Tencent Exmail (SSL supported)
  - 163 Mail (authorization code required)
  - Outlook
  - Other standard SMTP providers
- **Graceful fallback**: if disabled, output to console
- **Config stored in** `config.yaml` (restart required)

### 🎨 UI enhancements
- **Navigation links**: added to character cards page
  - Welcome page
  - Public character library
  - Forum
- **Responsive design**
- **Theme compatibility**
- **Modern registration page** (V1.13.12)
  - Sectioned form layout
  - Iconized fields
  - Gradient theme and animations
  - Responsive for desktop and mobile

### Admin default configuration template
- ? **Default template**: admins can snapshot any user’s settings as the default for new users
- ? **Selectable scope**: settings.json, API keys (secrets.json), presets, regex, character cards, lorebooks, themes, etc.
- ? **Auto-apply**: applied on registration/admin create/OAuth registration
- ? **Safety prompt**: warns admins when API keys are included

### Chat file sharding optimization
- ✅ **Shard chat files**: split JSONL every 200–500 messages for lighter I/O and faster backups
- ✅ **Lightweight chat index**: stores counts, last entry, timestamps, shard list for fast lists/previews
- ✅ **Incremental writes**: append diffs instead of rewriting full files to prevent data loss and reduce disk pressure
- ✅ **Client-side recent cache**: near-instant chat reopen
- ✅ **New endpoint**: fetch the last N messages and paginate backward instead of returning full JSONL
- ✅ **Load strategy**: fetch latest 20 on open, load more on demand
- ✅ **Mobile optimization**: limit DOM history (e.g., 200 nodes) to reduce scroll lag

## 🔧 Technical architecture

### Backend stack
- **Node.js + Express**: server framework
- **node-persist**: persistent storage
- **cookie-session**: session management
- **rate-limiter-flexible**: API rate limiting
- **multer**: file uploads
- **helmet**: security headers
- **nodemailer**: email service (V1.13.12)

### Frontend stack
- **Vanilla JavaScript**: no framework dependency
- **jQuery**: DOM manipulation and AJAX
- **FontAwesome**: icon system
- **CSS3**: modern styles and animations
- **Responsive layout**: mobile support

### Security features
- **CSRF protection**
- **Input validation**
- **SQL injection protection**
- **XSS protection**
- **Session security**

## 📦 Installation and deployment

### Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0
- 2GB+ RAM
- 10GB+ disk space

### Quick start
```bash
# Clone the project
git clone https://github.com/weetown/SillyTavernchat.git
cd SillyTavernchat

# Install dependencies
npm install

# Start the service
npm start

# Or use batch file (Windows)
Start.bat

# Or use shell script in the root (Linux)
sudo sh start.sh
```

### Docker deployment

- Docker Hub image: `sillytavernchat-zk` (https://hub.docker.com/r/zhaiker/sillytavernchat-zk)

#### Docker Compose (recommended)
```bash
# Run from project root
docker compose -f docker/docker-compose.yml up -d --build
```

If using the official image (no local build needed), change `image` in `docker/docker-compose.yml` to:
```
zhaiker/sillytavernchat-zk:latest
```

Directory notes (relative to `docker/docker-compose.yml`):
- `docker/config`: config directory (generates `config.yaml` on first run)
- `docker/data`: persistent data (users, forum, public characters, etc.)
- `docker/plugins`: plugins
- `docker/extensions`: third-party extensions

Common commands:
```bash
# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop and remove containers
docker compose -f docker/docker-compose.yml down
```

#### Docker run (optional)
```bash
docker pull zhaiker/sillytavernchat-zk:latest
docker build -t sillytavernchat:latest .
docker run -d --name sillytavernchat \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e FORCE_COLOR=1 \
  -v "$(pwd)/docker/config:/home/node/app/config" \
  -v "$(pwd)/docker/data:/home/node/app/data" \
  -v "$(pwd)/docker/plugins:/home/node/app/plugins" \
  -v "$(pwd)/docker/extensions:/home/node/app/public/scripts/extensions/third-party" \
  sillytavernchat:latest
```

If using the official image, replace the last line with:
```
zhaiker/sillytavernchat-zk:latest
```

> Tip: In Windows PowerShell, replace `$(pwd)` with `$PWD` and use backticks for line breaks. For external access, ensure `listen: true` in `config.yaml` and open port `8000`.

### Configuration
```yaml
# config.yaml main options
listen: true                    # listen on external interfaces
port: 8000                     # server port
whitelist: []                  # IP allowlist
basicAuthMode: false           # basic auth mode
enableExtensions: true        # enable extension system
enableInvitationCodes: true   # enable invitation system
enableForum: true             # enable forum system
enablePublicCharacters: true  # enable public character library
enableSystemLoadMonitoring: true  # enable system load monitoring
enableUserActivityStatistics: true  # enable user activity statistics
enableHistoryDataRecord: true  # enable history data recording
enableVisualizationChart: true  # enable visualization charts
enablePerformanceAlarm: true  # enable performance alerts
enableUserManagement: true  # enable user management
enableUserRegistration: true  # enable user registration
enableUserLogin: true  # enable user login
enableUserLogout: true  # enable user logout
enableUserProfile: true  # enable user profiles
enableUserSettings: true  # enable user settings
enableUserTheme: true  # enable user themes

# OAuth third-party login config (V1.13.12)
oauth:
  github:
    enabled: false            # enable GitHub OAuth
    clientId: ''              # GitHub OAuth App Client ID
    clientSecret: ''          # GitHub OAuth App Client Secret
    callbackUrl: ''           # callback URL (leave blank to auto-generate, supports reverse proxy)
  discord:
    enabled: false            # enable Discord OAuth
    clientId: ''              # Discord OAuth App Client ID
    clientSecret: ''          # Discord OAuth App Client Secret
    callbackUrl: ''           # callback URL (leave blank to auto-generate, supports reverse proxy)
  linuxdo:
    enabled: false            # enable Linux.do OAuth
    clientId: ''              # Linux.do OAuth App Client ID
    clientSecret: ''          # Linux.do OAuth App Client Secret
    callbackUrl: ''           # callback URL (leave blank to auto-generate, supports reverse proxy)
    authUrl: ''               # auth URL (default: https://connect.linux.do/oauth2/authorize)
    tokenUrl: ''              # token URL (default: https://connect.linux.do/oauth2/token)
    userInfoUrl: ''           # user info URL (default: https://connect.linux.do/api/user)

# Email service config (V1.13.12)
email:
  enabled: false              # enable email service
  smtp:
    host: ''                  # SMTP host (e.g., smtp.qq.com)
    port: 587                 # SMTP port (465 requires SSL; 587 uses STARTTLS)
    secure: false              # use SSL/TLS (port 465 must be true)
    user: ''                   # SMTP username (usually the email address)
    password: ''               # SMTP password or authorization code
  from: ''                     # from address
  fromName: 'SillyTavern'     # from name
```

**OAuth configuration notes**:
- Supports GitHub, Discord, and Linux.do OAuth providers
- Callback URL can be left blank; the system auto-generates based on current host (supports reverse proxy and SSL)
- If invitation codes are enabled, OAuth registrations require an invite code
- Restart required after config changes
- Obtain OAuth credentials:
  - **GitHub**: https://github.com/settings/developers
  - **Discord**: https://discord.com/developers/applications
  - **Linux.do**: contact Linux.do admins

**Email configuration notes**:
- With email enabled, user registration requires verification codes
- Password recovery codes are emailed to bound addresses
- If email is disabled, codes are printed to the server console
- Restart required after config changes
- Recommended to configure via the admin “Email Config” page and test sending

## 🎯 Usage guide

### Admin first-time setup
1. After startup, visit `http://localhost:8000`
2. Click “Login now” directly—do not register. The system auto-creates a default admin account without a password. Default admin username: `default-user`. Enter and create a new admin user in the admin panel.
3. Register the first user and promote them to admin
4. Log out of the default account, log in with the new admin account, and disable the default user
5. Generate invitation codes
6. Configure forum categories and permissions
7. (Optional) Publish login page announcements
8. (Optional) Configure OAuth (V1.13.12)
   - Create OAuth apps on third-party platforms and get Client ID/Secret
   - Edit `config.yaml` with provider credentials
   - Callback URL can be blank; it auto-generates (`http(s)://domain:port/api/oauth/provider/callback`)
   - Restart to show OAuth buttons on the login page
9. (Optional) Configure email (V1.13.12)
   - Open the admin “Email Config” page
   - Fill SMTP settings
   - Send a test email
   - Restart after saving
   - With email enabled, registration requires verification

### Regular user usage
1. Register an account
   - **Option 1: classic registration**: register with an invitation code
     - If email is enabled, provide email and verification code
     - Code is sent to your email and valid for 5 minutes
     - On success, the email is bound to your account
   - **Option 2: OAuth login** (V1.13.12)
     - Click GitHub/Discord/Linux.do on the login page
     - After authorization, return to the system
     - If invitations are enabled, first login requires a code
     - The system auto-syncs username, avatar, and email
     - OAuth users default to no password and can log in with OAuth

2. Set a password for OAuth users (V1.13.12)
   - Set via **Profile → Change Password**
   - **No old password required on first setup**, with friendly messaging
   - After setting a password, you can log in via:
     - OAuth (recommended)
     - Username + password
   - Profile shows your OAuth provider

3. Login modes
   - **OAuth users (no password)**: OAuth only
   - **OAuth users (with password)**: OAuth or password
   - **Classic users**: username + password

4. Use system features
   - Start AI chats
   - Participate in forum discussions
   - Share and download public character cards
   - Personalize settings and themes

5. Password recovery (V1.13.12)
   - If email is bound, recovery code is emailed
   - If email is not bound, recovery code appears in the server console (contact admin)
   - Recovery code valid for 5 minutes
   - **Note**: OAuth users without passwords cannot use password recovery; use OAuth login

## 🔐 OAuth third-party login technical details (V1.13.12)

### Implementation overview

#### 1. Username retrieval optimization
- **Issue**: Linux.do returns JWT tokens with only auth claims (sub, iss, aud), no user details
- **Solution**:
  1. Decode `access_token` JWT and check for username fields
  2. If only auth claims, call `/api/user` to fetch full profile data
  3. Support multiple username fields: `username`, `login`, `preferred_username`, `name`
  4. Handle nested structures (`user.username` or `username`)

#### 2. Avatar auto-sync
- **First registration**: download third-party avatar and store as base64 data URL
- **Each login**: refresh avatar to ensure it’s current
- **Formats**: JPEG, PNG, GIF, WebP, etc.
- **Error handling**: download failures do not block login

#### 3. Flexible login modes
- **Decision logic**:
  ```javascript
  if (user.oauthProvider && !user.password && !user.salt) {
    // OAuth-only user: OAuth login only
  } else if (user.oauthProvider && user.password && user.salt) {
    // OAuth user with password: OAuth or password login
  }
  ```
- **Password setup**:
  - OAuth users do not need to verify the old password the first time
  - Frontend hides the “current password” field
  - Friendly guidance messages

#### 4. Security features
- **State parameter**: prevents CSRF by using random state per authorization
- **JWT verification**: decode and validate JWT tokens
- **Session management**: secure sessions after OAuth login
- **Permission parity**: OAuth and classic users share the same permission system

### Supported OAuth providers

| Provider | Username field | Avatar field | Email field | Notes |
|----------|----------------|--------------|-------------|-------|
| **GitHub** | `login` | `avatar_url` | `email` | Standard OAuth2 |
| **Discord** | `username` | `avatar` | `email` | Requires avatar URL construction |
| **Linux.do** | `username` | `avatar_url` | `email` | Uses Discourse API |

### Configuration example

```yaml
oauth:
  linuxdo:
    enabled: true
    clientId: 'your_client_id_here'
    clientSecret: 'your_client_secret_here'
    callbackUrl: ''  # leave blank to auto-generate
    # Leave URLs blank to use defaults
    authUrl: 'https://connect.linux.do/oauth2/authorize'
    tokenUrl: 'https://connect.linux.do/oauth2/token'
    userInfoUrl: 'https://connect.linux.do/api/user'  # Discourse API endpoint
```

### API endpoints

#### OAuth flow
1. **GET** `/api/oauth/:provider` - start OAuth authorization
2. **GET** `/api/oauth/:provider/callback` - OAuth callback handler
3. **POST** `/api/oauth/complete-registration` - complete invite validation (if required)

#### Linux.do endpoints
- **Authorization**: `https://connect.linux.do/oauth2/authorize`
- **Token**: `https://connect.linux.do/oauth2/token`
- **User info**: `https://connect.linux.do/api/user` (returns full user data)

#### Linux.do response example
```json
{
  "id": 107981,
  "username": "ZhaiKer",
  "name": "Ker Zhai",
  "email": "user@example.com",
  "avatar_url": "https://linux.do/user_avatar/linux.do/zhaiker/288/493521_2.png",
  "active": true,
  "trust_level": 3,
  "silenced": false
}
```

## 🛠️ Development guide

### Directory structure
```
SillyTavernchat/
├── src/                    # Backend source
│   ├── endpoints/         # API endpoints
│   │   ├── users-public.js  # Public user API (login, registration, recovery)
│   │   ├── users-private.js # Private user API (password/avatar/profile)
│   │   ├── users-admin.js   # Admin user management API
│   │   ├── forum.js      # Forum API
│   │   ├── system-load.js # System monitoring API
│   │   ├── invitation-codes.js # Invitation API
│   │   ├── announcements.js # Announcements API
│   │   ├── oauth.js         # OAuth API (V1.13.12)
│   │   │                    # - GitHub/Discord/Linux.do
│   │   │                    # - Avatar download/sync
│   │   │                    # - JWT parsing and user info fetch
│   │   │                    # - Flexible password/login
│   │   ├── oauth-config.js  # OAuth config API (V1.13.12)
│   │   ├── email-config.js  # Email config API (V1.13.12)
│   │   └── email-status.js  # Email status API (V1.13.12)
│   ├── middleware/        # Middleware
│   ├── system-monitor.js  # System monitoring core
│   ├── users.js          # User management core (OAuth logic optimized)
│   └── email-service.js   # Email service core (V1.13.12)
├── public/                # Frontend assets
│   ├── login.html        # Login page (OAuth buttons)
│   ├── register.html     # Registration page
│   ├── forum.html        # Forum page
│   ├── public-characters.html # Public character library
│   └── scripts/          # JavaScript
│       ├── user.js       # User management frontend (password setup logic)
│       └── templates/    # HTML templates
│           ├── userProfile.html  # Profile (OAuth provider display)
│           └── changePassword.html # Password change form
└── data/                 # Data storage
    ├── default-user/     # Default user data
    ├── system-monitor/   # Monitoring data
    ├── forum_data/       # Forum data
    └── announcements/    # Announcement data
        ├── announcements.json       # Main site announcements
        └── login_announcements.json # Login page announcements
```

## 🤝 Contribution guide

### Submit code
1. Fork the project to your GitHub account
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

### Report issues
- Use GitHub Issues to report bugs
- Provide detailed error info and reproduction steps
- Include system environment details

## 📄 License
This project is licensed under AGPL-3.0. See [LICENSE](LICENSE).

## 🙏 Acknowledgements
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - for the excellent foundation
- All contributors and community members

## 📞 Contact
- Project homepage: https://github.com/zhaiiker/SillyTavernchat
- Issues: https://github.com/zhaiiker/SillyTavernchat/issues
- Discussions: https://github.com/zhaiiker/SillyTavernchat/discussions

---

**SillyTavernchat** - Make AI chat smarter, and the community more vibrant! 🎉
