package su.povolzhye.code2ai.termipus.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import su.povolzhye.code2ai.termipus.terminal.TerminalSession;
import su.povolzhye.code2ai.termipus.terminal.TerminalSessionManager;

/** WebSocket handler that bridges browser terminal clients to PTY sessions. */
@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {

  private final TerminalSessionManager sessionManager;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final Map<String, String> wsToTerminal = new ConcurrentHashMap<>();

  /**
   * Creates the handler with the given session manager.
   *
   * @param sessionManager manages PTY sessions
   */
  public TerminalWebSocketHandler(TerminalSessionManager sessionManager) {
    this.sessionManager = sessionManager;
  }

  @Override
  protected void handleTextMessage(WebSocketSession ws, TextMessage message) throws IOException {
    String payload = message.getPayload();

    if (payload.startsWith("{")) {
      JsonNode json = objectMapper.readTree(payload);
      if ("init".equals(json.path("type").asText())) {
        initSession(ws, json.path("cols").asInt(80), json.path("rows").asInt(24));
        return;
      }
      if ("resize".equals(json.path("type").asText())) {
        TerminalSession s = sessionManager.get(wsToTerminal.get(ws.getId()));
        if (s != null) {
          s.resize(json.path("cols").asInt(80), json.path("rows").asInt(24));
        }
        return;
      }
    }

    TerminalSession session = sessionManager.get(wsToTerminal.get(ws.getId()));
    if (session != null) {
      session.getOutputStream().write(payload.getBytes(StandardCharsets.UTF_8));
      session.getOutputStream().flush();
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession ws, CloseStatus status) {
    String id = wsToTerminal.remove(ws.getId());
    if (id != null) {
      sessionManager.close(id);
    }
  }

  private void initSession(WebSocketSession ws, int cols, int rows) throws IOException {
    TerminalSession session = sessionManager.create(cols, rows);
    wsToTerminal.put(ws.getId(), session.getId());

    Thread.ofVirtual().start(() -> {
      byte[] buf = new byte[4096];
      int n;
      try (var in = session.getInputStream()) {
        while ((n = in.read(buf)) != -1 && ws.isOpen()) {
          ws.sendMessage(new TextMessage(new String(buf, 0, n, StandardCharsets.UTF_8)));
        }
      } catch (IOException ignored) {
        // Session closed or connection lost — normal termination, nothing to recover
      }
    });
  }
}
