# Разработка

## Требования

- Java 21 (проверить: `java -version`)
- Maven 3.9+ (проверить: `mvn -version`)
- Node.js 20+ только для локальной разработки расширения без Maven

## Сборка

```bash
# Полная сборка всех модулей + тесты
mvn verify

# Только сервер
cd server && mvn verify

# Только расширение
cd extension && mvn verify
# или напрямую:
cd extension && npm ci && npm test && npm run build
```

## Запуск сервера

```bash
cd server
mvn spring-boot:run
```

Сервер запускается на порту 8080. Порт можно переопределить: `SERVER_PORT=9090 mvn spring-boot:run`

Проверить работу без расширения:
```bash
# установить websocat: https://github.com/vi/websocat/releases
websocat ws://localhost:8080/terminal
# ввести первым сообщением:
{"type":"init","cols":80,"rows":24}
```

## Разработка расширения

```bash
cd extension
npm ci
npm run watch         # пересборка при изменениях
npm run build:chrome  # сборка для Chrome
npm run build:firefox # сборка для Firefox
```

Или через Maven (рекомендуется — аналогично CI):
```bash
cd extension && mvn package
```

Загрузить в Chrome: `chrome://extensions/` → Developer mode → Load unpacked → `extension/dist/`

Загрузить в Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `extension/dist/manifest.json`

## Тесты

```bash
# Все тесты
mvn test

# Только Java
cd server && mvn test

# Только TypeScript
cd extension && npm test
cd extension && npm test -- --coverage  # с отчётом покрытия
```

## Качество кода

```bash
# Checkstyle (Google Java Style), SpotBugs, PMD и сортировка pom.xml
cd server && mvn checkstyle:check spotbugs:check pmd:check
mvn sortpom:sort  # обязательно перед коммитом
```

## Структура веток

- `main` — стабильная ветка, прямые коммиты запрещены
- `feature/<автор>/#<issue>` — рабочие ветки

Стратегия слияния: rebase (не merge commits).
