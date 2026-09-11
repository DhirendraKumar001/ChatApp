# Between — a two-person chat app

A 1-to-1 chat application (no groups) built with Spring Boot, MySQL, JWT authentication,
and real-time delivery over WebSocket/STOMP — plus a small static frontend so it's usable
out of the box, not just an API.

- Register / log in and get a JWT.
- Message any other registered user directly.
- **Edit only your own messages.**
- **Delete any message (yours or theirs) "from your profile"** — a soft, per-user delete:
  it disappears from *your* view only; the other participant still sees it.
- Messages, edits, and your own deletions arrive **instantly** over WebSocket, with REST
  as a fallback/history source — either channel keeps the other in sync.

## Tech stack

- Java 21, Maven
- Spring Boot 4.1.1 (Web, Security, Data JPA, Validation, WebSocket)
- Spring Security 7 + JWT (`io.jsonwebtoken` / jjwt 0.12.6) — protects both REST endpoints
  and the WebSocket handshake
- STOMP over WebSocket (`spring-boot-starter-websocket`) for real-time delivery
- MySQL (`mysql-connector-j`); H2 also on the classpath for quick local testing
- Lombok
- Plain HTML/CSS/JS frontend (no build step) served as Spring Boot static resources

## Project structure

```
chatapp/
├── pom.xml
├── src/main/resources/
│   ├── application.properties
│   └── static/                     # frontend — served at http://localhost:8080/
│       ├── index.html              # routes to chat.html or login.html
│       ├── login.html / js/login.js
│       ├── register.html / js/register.js
│       ├── chat.html / js/chat.js  # the app itself
│       ├── css/style.css
│       └── js/api.js               # session storage + fetch/WS helpers
└── src/main/java/com/chat/app/
    ├── ChatApplication.java
    ├── config/
    │   ├── SecurityConfig.java       # JWT filter chain, public paths
    │   └── WebSocketConfig.java      # STOMP endpoint, per-user queue broker
    ├── security/
    │   ├── JwtUtil.java              # sign/parse/validate JWTs
    │   ├── JwtAuthFilter.java        # REST: reads Authorization header
    │   ├── JwtHandshakeInterceptor.java  # WS: reads ?token= at handshake
    │   ├── JwtHandshakeHandler.java      # WS: binds verified user as session Principal
    │   └── CustomUserDetailsService.java
    ├── entity/       User, Message, MessageDeletion
    ├── repository/   UserRepository, MessageRepository, MessageDeletionRepository
    ├── dto/          RegisterRequest, LoginRequest, AuthResponse, MessageRequest,
    │                 MessageEditRequest, MessageResponse, UserResponse
    ├── service/      UserService, MessageService, ChatNotificationService
    ├── controller/   AuthController, UserController, MessageController,
    │                 ChatWebSocketController
    └── exception/    GlobalExceptionHandler, ResourceNotFoundException,
                       UnauthorizedActionException, DuplicateResourceException
```

## Running it

1. Create a MySQL database (or edit `application.properties` to point at yours):
   ```sql
   CREATE DATABASE chatdb;
   ```
   (`createDatabaseIfNotExist=true` is already set, so this step is optional.)
2. Update the datasource credentials in `src/main/resources/application.properties`.
3. Run:
   ```bash
   mvn spring-boot:run
   ```
4. Open **http://localhost:8080** — you'll land on the sign-in page. Create two accounts
   (e.g. in two separate browser profiles / incognito windows) to chat between them.

## How authentication & authorization work

1. **Authentication**: `POST /api/auth/register` and `POST /api/auth/login` are the only
   public REST endpoints. Passwords are BCrypt-hashed. Both return a JWT.
2. Every other REST request needs `Authorization: Bearer <token>`; `JwtAuthFilter`
   validates it and populates the `SecurityContext`, so `Authentication.getName()` always
   returns the caller's *own* username — never trusted from the request body.
3. **WebSocket auth**: since a browser can't set an `Authorization` header during a WS
   handshake, the token is passed as `?token=...` in the connection URL.
   `JwtHandshakeInterceptor` validates it before the upgrade is allowed, and
   `JwtHandshakeHandler` binds the verified username as that session's `Principal` — every
   message sent afterwards is attributed to that identity, never to anything the client
   payload claims.
4. **Authorization** lives in `MessageService`, not the client:
   - **Edit** → `403 Forbidden` unless you're the message's original sender.
   - **Delete** → allowed for any message where you're a participant (sender or
     receiver), but it only inserts a `MessageDeletion` marker for *you* — the shared
     `Message` row is never touched, so the other participant is unaffected.

## REST API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account, returns a JWT |
| POST | `/api/auth/login` | — | Log in, returns a JWT |
| GET | `/api/users` | ✅ | List everyone else you can message |
| POST | `/api/messages` | ✅ | Send a message (`{receiverUsername, content}`) |
| GET | `/api/messages/{username}?page=0&size=20` | ✅ | Paginated conversation, newest first |
| PUT | `/api/messages/{id}` | ✅ | Edit — sender only |
| DELETE | `/api/messages/{id}` | ✅ | Delete from your profile — any participant |

Full request/response bodies match the DTOs in `dto/` (`RegisterRequest`, `LoginRequest`,
`MessageRequest`, `MessageEditRequest`; responses are `AuthResponse`, `UserResponse`,
`MessageResponse`).

## Real-time chat (WebSocket / STOMP)

REST still works standalone (e.g. load history with `GET /api/messages/{username}`) —
WebSocket is the live-delivery layer on top; sending via either channel notifies both.

**Connect:** `ws://localhost:8080/ws?token=<JWT>`

**Subscribe to** (all private, per-user — there is no `/topic` broadcast channel, so
group messaging is structurally impossible, not just unused):

| Destination | Fires when |
|---|---|
| `/user/queue/messages` | You receive (or send) a new message |
| `/user/queue/messages.updated` | A message in one of your conversations is edited |
| `/user/queue/messages.deleted` | You delete a message from your profile (id in body) |
| `/user/queue/errors` | Something you sent over the socket was rejected |

**Send:** publish `{"receiverUsername": "bob", "content": "Hey Bob!"}` to `/app/chat.send`.
The sender is always taken from the authenticated session, never this payload.

## Frontend pages

Static, no build step, served straight from `src/main/resources/static/`:

- `login.html` / `register.html` — auth forms, store the JWT in `localStorage`, redirect
  into the app.
- `chat.html` — the app: a people list on the left, the open conversation on the right,
  edit (own messages only) and delete (any message, "from my profile") controls on each
  bubble, live updates via the WebSocket subscriptions above.

These pages are publicly loadable (`SecurityConfig` permits `/`, `/*.html`, `/css/**`,
`/js/**`) so a logged-out browser can reach the login screen — actual data access is still
fully gated by the JWT-protected REST/WebSocket APIs underneath.

## Troubleshooting

Issues that came up while building this out, in case you hit them again after further changes:

- **`package ... does not exist` / `cannot find symbol`** — usually a package name
  mismatch between what a file declares (`package com.chat.app...`) and the folder it's
  actually sitting in, or a stale/duplicate copy of a file with the old package name still
  present. Fix: make sure every `.java` file's `package` line matches its folder path
  exactly, and there's only one copy of each class.
- **`AntPathRequestMatcher` / `PathPatternRequestMatcher` import errors** — Spring
  Security 7 removed `AntPathRequestMatcher` entirely. This project avoids the whole
  problem in `JwtAuthFilter` by using plain `org.springframework.util.AntPathMatcher`
  (Spring Core, not Spring Security) instead.
- **`@SendToUser` import error** — it lives in `org.springframework.messaging.simp.annotation`,
  not `org.springframework.messaging.handler.annotation` (only `@SendTo` is there).
- **A 500 on `/favicon.ico`** — harmless; browsers auto-request it. `GlobalExceptionHandler`
  explicitly maps `NoResourceFoundException` to a proper `404`, and every page links an
  empty data-URI favicon so the browser stops asking at all.
- **`Unable to start web server` on startup** — almost always port 8080 already in use
  (common after a DevTools restart leaves an old process running). Find and kill it
  (`netstat -ano | findstr :8080` then `taskkill /PID <pid> /F` on Windows), or change
  `server.port` in `application.properties` temporarily to confirm.
- **A page/link "does nothing"** — check the browser DevTools **Console** and **Network**
  tabs (not the server terminal) for the actual client-side error or HTTP status code;
  that's where issues like this always show up first.

## Notes / things to harden for production

- Move `jwt.secret` out of `application.properties` into an environment variable or
  secrets manager, and use a longer, randomly generated key.
- Add refresh tokens / token revocation if you need logout-everywhere semantics.
- Add rate limiting on `/api/auth/**` to slow down credential stuffing.
- Add integration tests (`spring-security-test` is already on the classpath) covering the
  edit/delete authorization rules.
- Presence ("online"/"last seen") isn't implemented — Spring's `SimpUserRegistry` (auto
  available once `@EnableWebSocketMessageBroker` is on) can track connected sessions per
  username if you want to add that later.
