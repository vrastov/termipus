# Termipus

**Termipus** (от *term*inal + oct*opus*) — браузерное расширение для Chrome и Firefox, которое встраивает терминальную панель в страницы GitLab и GitHub.

Терминал подключается к локальному серверу через WebSocket и запускает интерактивные процессы через PTY — включая AI-ассистентов (Kiro, Claude и др.), оболочки и любые CLI-инструменты.

## Возможности

- Терминальная панель на страницах MR, PR, Issue и других сущностях GitLab и GitHub
- Поддержка TUI-приложений (vim, htop, AI-ассистенты и др.) через xterm.js
- Настраиваемый адрес сервера (localhost или удалённый)
- Chrome и Firefox из одной кодовой базы

## Быстрый старт

### Требования

- Java 21+
- Maven 3.9+
- Node.js 20+ (скачивается автоматически через frontend-maven-plugin)

### Предполагаемая структура рабочей директории

Termipus клонирует репозитории проектов в заранее подготовленную директорию и создаёт worktree для параллельной работы над задачами:

```
workdir/
├── <проект>/              # основной репозиторий (дефолтная ветка)
├── <проект>-<агент>-5/    # worktree для issue #5
└── <проект>-<агент>-7/    # worktree для issue #7
```

Ветки для задач именуются `feature/<агент>/#N`. При работе с Issue — создаётся новая ветка `feature/<агент>/#N` от main. При работе с MR — используется уже существующая ветка issue, связанного с этим MR.

### Сборка

```bash
git clone https://gitlab.com/povolzhye/code2ai/termipus.git
cd termipus
mvn verify
```

### Запуск сервера

```bash
cd server
mvn spring-boot:run
# Сервер доступен на http://localhost:8080
```

### Установка расширения

1. Собрать расширение: `cd extension && npm run build:chrome`
2. Открыть `chrome://extensions/` → включить Developer mode
3. Load unpacked → выбрать папку `extension/dist/`
4. Открыть любой MR на gitlab.com — появится кнопка "⌨ Terminal"

## Структура проекта

```
termipus/
├── pom.xml              # Parent POM, мультимодульный Maven
├── server/              # Spring Boot сервер (Java 21)
│   └── src/main/java/su/povolzhye/code2ai/termipus/
│       ├── terminal/    # PTY сессии (pty4j)
│       ├── websocket/   # WebSocket endpoint
│       └── config/      # CORS
├── extension/           # Browser extension (TypeScript)
│   └── src/
│       ├── content/     # Инжект в GitLab/GitHub
│       ├── terminal/    # xterm.js панель + WebSocket клиент
│       └── popup/       # Настройки расширения
└── .gitlab-ci.yml       # CI pipeline
```

## Документация

- [Use Cases](docs/use-cases.md)
- [Архитектура](docs/architecture.md)
- [Разработка](docs/development.md)
- [Участие в проекте](CONTRIBUTING.md)

## CI/CD

- GitLab CI — основной pipeline: сборка, тесты, SonarCloud анализ
- GitHub — зеркало для форков
- Quality Gate: покрытие тестами ≥ 80%, Google Java Style
