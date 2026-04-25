package su.povolzhye.code2ai.termipus.websocket;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import su.povolzhye.code2ai.termipus.terminal.TerminalSession;
import su.povolzhye.code2ai.termipus.terminal.TerminalSessionManager;

class TerminalWebSocketHandlerTest {

  private TerminalSessionManager sessionManager;
  private TerminalWebSocketHandler handler;
  private WebSocketSession ws;

  @BeforeEach
  void setUp() {
    sessionManager = mock(TerminalSessionManager.class);
    handler = new TerminalWebSocketHandler(sessionManager);
    ws = mock(WebSocketSession.class);
    when(ws.getId()).thenReturn("ws-1");
  }

  @Test
  void handleTextMessage_init_createsSession() throws Exception {
    TerminalSession session = mockSession("sess-1");
    when(sessionManager.create(80, 24)).thenReturn(session);

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    verify(sessionManager).create(80, 24);
  }

  @Test
  void handleTextMessage_resize_resizesSession() throws Exception {
    TerminalSession session = mockSession("sess-1");
    when(sessionManager.get(null)).thenReturn(null);
    // init first to register the mapping
    when(sessionManager.create(80, 24)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    when(sessionManager.get("sess-1")).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    verify(session).resize(120, 40);
  }

  @Test
  void handleTextMessage_plainText_writesToOutputStream() throws Exception {
    TerminalSession session = mockSession("sess-1");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    when(session.getOutputStream()).thenReturn(out);
    when(sessionManager.create(80, 24)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    when(sessionManager.get("sess-1")).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("ls"));

    verify(session, org.mockito.Mockito.times(2)).getOutputStream();
  }

  @Test
  void handleTextMessage_noSession_doesNotThrow() {
    when(sessionManager.get(any())).thenReturn(null);
    assertDoesNotThrow(() -> handler.handleTextMessage(ws, new TextMessage("ls")));
  }

  @Test
  void afterConnectionClosed_withSession_closesIt() throws Exception {
    TerminalSession session = mockSession("sess-1");
    when(sessionManager.create(80, 24)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);

    verify(sessionManager).close("sess-1");
  }

  @Test
  void afterConnectionClosed_noSession_doesNotClose() {
    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);
    verify(sessionManager, never()).close(any());
  }

  private TerminalSession mockSession(String id) {
    TerminalSession session = mock(TerminalSession.class);
    when(session.getId()).thenReturn(id);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    return session;
  }
}
