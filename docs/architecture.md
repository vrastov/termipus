# Архитектура Termipus

## Обзор

```
Браузер (xterm.js) ←──WebSocket──→ Сервер (Spring Boot) ←──PTY──→ Процесс
       ↑                                                              (bash, kiro, etc.)
  Расширение
  (content script)
```

## Компоненты

### Browser Extension

Content script инжектируется в страницы GitLab и GitHub. При клике на кнопку "Terminal" открывается панель с xterm.js, которая подключается к серверу по WebSocket.

**Ключевые модули:**
- `content/index.ts` — определяет сайт, вешает обработчики навигации (SPA), создаёт `TerminalPanel`
- `content/gitlab/inject.ts` — инжект кнопки в UI GitLab
- `content/github/inject.ts` — инжект кнопки в UI GitHub
- `terminal/panel.ts` — xterm.js панель, FitAddon, ResizeObserver
- `terminal/socket.ts` — клиент WebSocket через `chrome.runtime.connect` (делегирует в background)
- `background/background.ts` — service worker: держит WebSocket, проксирует сообщения через порт
- `popup/popup.ts` — настройки (адрес сервера в chrome.storage)

**Поток данных:**

```
xterm.js (panel.ts)
    │ onData / write
    ▼
socket.ts  ──chrome.runtime port──▶  background.ts  ──WebSocket──▶  Сервер
    ▲                                      │
    └──────────────────────────────────────┘
```

**Почему WebSocket в background service worker:**
GitLab и GitHub отдают страницы по HTTPS со строгим CSP (`connect-src` не включает `ws://localhost`).
Content scripts наследуют CSP страницы — прямой `new WebSocket('ws://...')` из content script блокируется браузером.
Background service worker не привязан к CSP страницы и может открывать любые соединения, разрешённые в `host_permissions` манифеста.

**Сборка:** esbuild + TypeScript → единый бандл. Один манифест для Chrome и Firefox (Manifest V3), минимальные overrides в `manifest.firefox.json`.

### Server

Spring Boot приложение. Принимает WebSocket подключения, создаёт PTY процессы через pty4j, проксирует ввод/вывод.

**Ключевые классы:**
- `TerminalSession` — обёртка над `PtyProcess` (pty4j)
- `TerminalSessionManager` — создание и хранение сессий (ConcurrentHashMap)
- `TerminalWebSocketHandler` — маппинг WS сессий на PTY сессии
- `WebSocketConfig` — регистрация endpoint `/terminal`
- `CorsConfig` — разрешает запросы с `chrome-extension://` и `moz-extension://`

**Виртуальные потоки (Java 21):** каждая PTY сессия читает вывод в отдельном виртуальном потоке (`Thread.ofVirtual()`).

## Протокол WebSocket

```
Клиент → Сервер:
  {"type": "init", "cols": 80, "rows": 24}   # первое сообщение
  {"type": "resize", "cols": 120, "rows": 30} # изменение размера
  "ls -la\r"                                  # ввод пользователя

Сервер → Клиент:
  "\u001b[1;34muser@host\u001b[0m:~$ "        # вывод (ANSI escape codes)
```

## Mixed Content

GitLab и GitHub работают по HTTPS со строгим CSP. Content scripts наследуют CSP страницы,
поэтому WebSocket-соединение вынесено в background service worker (см. выше).

Для удалённого сервера (не localhost) потребуется WSS — самоподписанный сертификат с однократным
принятием пользователем, либо Let's Encrypt.

## CI/CD

```
push/MR
  ├── build (maven:3.9-eclipse-temurin-21)
  │     mvn verify
  │     └── server: compile + test + jacoco
  │     └── extension: npm ci + jest --coverage + esbuild
  └── sonar (только main и MR)
        mvn checkstyle:check pmd:check spotbugs:check sonar:sonar
```

SonarCloud Quality Gate: покрытие нового кода ≥ 80%.
