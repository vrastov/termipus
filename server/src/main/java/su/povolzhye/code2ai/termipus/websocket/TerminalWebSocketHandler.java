package su.povolzhye.code2ai.termipus.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import su.povolzhye.code2ai.termipus.terminal.SessionCreationException;
import su.povolzhye.code2ai.termipus.terminal.TerminalSession;
import su.povolzhye.code2ai.termipus.terminal.TerminalSessionManager;

/**
 * WebSocket обработчик для моста между браузерным терминалом и PTY сессиями.
 */
@Component
public final class TerminalWebSocketHandler extends TextWebSocketHandler {

  /** Логгер. */
  private static final Logger LOGGER =
      LoggerFactory.getLogger(TerminalWebSocketHandler.class);

  /** Размер буфера чтения вывода PTY процесса. */
  private static final int READ_BUFFER_SIZE = 8192;

  /** Количество колонок по умолчанию. */
  private static final int DEFAULT_COLS = 80;

  /** Количество строк по умолчанию. */
  private static final int DEFAULT_ROWS = 24;

  /** Менеджер PTY сессий. */
  private final TerminalSessionManager sessionManager;

  /** JSON-маппер для разбора входящих сообщений. */
  private final ObjectMapper objectMapper = new ObjectMapper();

  /** Карта WebSocket ID -&gt; ID PTY сессии. */
  private final Map<String, String> wsToTerminal = new ConcurrentHashMap<>();

  /**
   * Создаёт обработчик с заданным менеджером сессий.
   *
   * @param manager менеджер PTY сессий
   */
  public TerminalWebSocketHandler(final TerminalSessionManager manager) {
    this.sessionManager = manager;
  }

  @Override
  protected void handleTextMessage(
      final WebSocketSession ws, final TextMessage message) throws IOException {
    String payload = message.getPayload();

    if (payload.startsWith("{")) {
      JsonNode json = objectMapper.readTree(payload);
      String type = json.path("type").asText();
      if ("init".equals(type)) {
        initSession(ws,
            json.path("cols").asInt(DEFAULT_COLS),
            json.path("rows").asInt(DEFAULT_ROWS));
        return;
      }
      if ("resize".equals(type)) {
        handleResize(ws, json);
        return;
      }
    }

    handleInput(ws, payload);
  }

  @Override
  public void afterConnectionClosed(
      final WebSocketSession ws, final CloseStatus status) {
    String sessionId = wsToTerminal.remove(ws.getId());
    if (sessionId != null) {
      sessionManager.closeSession(sessionId);
    }
  }

  private void handleResize(final WebSocketSession ws, final JsonNode json) {
    String sessionId = wsToTerminal.get(ws.getId());
    if (sessionId == null) {
      return;
    }
    try {
      sessionManager.resizeSession(sessionId,
          json.path("cols").asInt(DEFAULT_COLS),
          json.path("rows").asInt(DEFAULT_ROWS));
    } catch (IllegalArgumentException e) {
      LOGGER.debug("Resize requested for non-existent session: {}", sessionId, e);
    }
  }

  private void handleInput(
      final WebSocketSession ws, final String payload) throws IOException {
    String sessionId = wsToTerminal.get(ws.getId());
    if (sessionId == null) {
      return;
    }
    TerminalSession session = sessionManager.getSession(sessionId);
    if (session == null) {
      return;
    }
    String input = payload.replace("\n", "\r");
    if (!input.endsWith("\r")) {
      input += "\r";
    }
    session.getOutputStream().write(input.getBytes(StandardCharsets.UTF_8));
    session.getOutputStream().flush();
  }

  private void initSession(
      final WebSocketSession ws,
      final int cols,
      final int rows) throws IOException {
    String[] shellCommand = resolveShellCommand();
    String sessionId;
    try {
      sessionId = sessionManager.createSession(
          shellCommand, null, null, cols, rows);
    } catch (SessionCreationException e) {
      ws.sendMessage(
          new TextMessage(
              "{\"error\": \"Failed to create terminal session\"}"));
      ws.close(CloseStatus.POLICY_VIOLATION);
      return;
    }
    wsToTerminal.put(ws.getId(), sessionId);

    TerminalSession session = sessionManager.getSession(sessionId);
    if (session == null) {
      ws.sendMessage(
          new TextMessage("{\"error\": \"Session not found after creation\"}"));
      ws.close(CloseStatus.POLICY_VIOLATION);
      return;
    }

    Thread.ofVirtual().start(() -> readOutput(ws, session));
  }

  private void readOutput(final WebSocketSession ws, final TerminalSession session) {
    byte[] buf = new byte[READ_BUFFER_SIZE];
    try (var in = session.getInputStream()) {
      int n;
      while ((n = in.read(buf)) != -1 && ws.isOpen()) {
        if (!trySend(ws, new String(buf, 0, n, StandardCharsets.UTF_8))) {
          break;
        }
      }
      drainRemaining(ws, in, buf);
    } catch (IOException e) {
      LOGGER.debug("PTY stream closed", e);
    }
    tryCloseWebSocket(ws);
  }

  private void drainRemaining(
      final WebSocketSession ws,
      final InputStream in,
      final byte[] buf) {
    long deadline = System.currentTimeMillis() + 500;
    try {
      while (System.currentTimeMillis() < deadline && ws.isOpen()) {
        if (in.available() > 0) {
          int n = in.read(buf);
          if (n > 0 && !trySend(ws, new String(buf, 0, n, StandardCharsets.UTF_8))) {
            break;
          }
        } else {
          Thread.sleep(10);
        }
      }
    } catch (IOException e) {
      LOGGER.debug("PTY drain error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  /**
   * Отправляет сообщение в WebSocket.
   *
   * @param ws WebSocket сессия
   * @param text текст для отправки
   * @return true если отправлено успешно, false если WebSocket уже закрыт
   */
  private boolean trySend(final WebSocketSession ws, final String text) {
    try {
      ws.sendMessage(new TextMessage(text));
      return true;
    } catch (IOException | IllegalStateException e) {
      // WebSocket уже закрыт клиентом — нормальное завершение
      return false;
    }
  }

  private void tryCloseWebSocket(final WebSocketSession ws) {
    try {
      if (ws.isOpen()) {
        ws.close(CloseStatus.NORMAL);
      }
    } catch (IOException e) {
      LOGGER.debug("Failed to close WebSocket", e);
    }
  }

  private String[] resolveShellCommand() {
    String os = System.getProperty("os.name").toLowerCase();
    if (os.contains("win")) {
      return new String[]{"cmd.exe", "/Q"};
    } else {
      return new String[]{
          System.getenv().getOrDefault("SHELL", "/bin/bash"), "-i"
      };
    }
  }
}
