# Модуль `server`

Серверная часть Termipus — WebSocket-шлюз для PTY-сессий. Обеспечивает удалённый доступ к терминалу
через браузерное расширение.

## Структура пакетов

- `su.povolzhye.code2ai.termipus.terminal` — управление PTY-сессиями на базе `pty4j`
- `su.povolzhye.code2ai.termipus.websocket` — WebSocket endpoint и обработка сообщений
- `su.povolzhye.code2ai.termipus.config` — конфигурация сервера (порт, CORS)

## Запуск

```bash
./gradlew :server:run
```

Сервер стартует на порту `8080`. WebSocket endpoint доступен по адресу `ws://localhost:8080/terminal`.

## Конфигурация

Параметры задаются через переменные окружения или `application.properties`:

| Переменная          | По умолчанию | Описание                    |
|---------------------|--------------|-----------------------------|
| `SERVER_PORT`       | `8080`       | HTTP/WebSocket порт         |
| `CORS_ALLOWED_ORIGIN`| `*`         | Разрешённые источники (CORS)|

## Дополнительная документация

- [Корневой README](../README.md)
- [Архитектура проекта](../docs/architecture.md)
