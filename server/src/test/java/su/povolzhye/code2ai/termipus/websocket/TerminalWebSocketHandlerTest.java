package su.povolzhye.code2ai.termipus.websocket;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import su.povolzhye.code2ai.termipus.terminal.SessionCreationException;
import su.povolzhye.code2ai.termipus.terminal.TerminalSession;
import su.povolzhye.code2ai.termipus.terminal.TerminalSessionManager;

/**
 * Unit-тесты для TerminalWebSocketHandler.
 * Проверяют обработку WebSocket сообщений: создание PTY сессии, изменение размера,
 * передачу команд и закрытие сессии.
 */
class TerminalWebSocketHandlerTest {

  private TerminalSessionManager sessionManager;
  private TerminalWebSocketHandler handler;
  private WebSocketSession ws;

  @BeforeEach
  void setUp() {
    // Создаём мок менеджера сессий и обработчик
    sessionManager = mock(TerminalSessionManager.class);
    handler = new TerminalWebSocketHandler(sessionManager);
    ws = mock(WebSocketSession.class);
    when(ws.getId()).thenReturn("ws-1");
  }

  /**
   * Создаёт мок сессии с заглушками для потоков.
   *
   * @return сконфигурированный мок TerminalSession
   */
  private TerminalSession mockSession() {
    TerminalSession session = mock(TerminalSession.class);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(session.isAlive()).thenReturn(true);
    when(session.getPid()).thenReturn(12345L);
    return session;
  }

  @Test
  void afterConnectionEstablished_doesNotThrow() {
    assertDoesNotThrow(() -> handler.afterConnectionEstablished(ws));
  }

  @Test
  void handleTextMessage_init_createsSession() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    verify(sessionManager).createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24));
  }

  @Test
  void handleTextMessage_init_failure_sendsErrorAndCloses() throws Exception {
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenThrow(new SessionCreationException("Failed", new RuntimeException()));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    verify(ws).sendMessage(new TextMessage("{\"error\": \"Failed to create terminal session\"}"));
    verify(ws).close(CloseStatus.POLICY_VIOLATION);
  }

  @Test
  void handleTextMessage_resize_resizesSession() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    verify(sessionManager).resizeSession(sessionId, 120, 40);
  }

  @Test
  void handleTextMessage_resize_noSession_ignores() throws Exception {
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    verify(sessionManager, never()).resizeSession(anyString(), anyInt(), anyInt());
  }

  @Test
  void handleTextMessage_plainText_writesToOutputStream() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    TerminalSession session = mock(TerminalSession.class);
    when(session.getOutputStream()).thenReturn(out);
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    String command = "ls -la\n";
    handler.handleTextMessage(ws, new TextMessage(command));

    verify(session, times(2)).getOutputStream();
    String written = out.toString();
    assertTrue(written.contains("ls -la\r"), "Expected command with \\r, got: " + written);
  }

  @Test
  void handleTextMessage_plainText_noSession_doesNotWrite() throws Exception {
    handler.handleTextMessage(ws, new TextMessage("some command"));

    verify(sessionManager, never()).getSession(anyString());
  }

  @Test
  void afterConnectionClosed_withSession_closesIt() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);

    verify(sessionManager).closeSession(sessionId);
  }

  @Test
  void afterConnectionClosed_noSession_doesNotClose() {
    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);

    verify(sessionManager, never()).closeSession(anyString());
  }

  @Test
  void handleTransportError_closesSessionAndWebSocket() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    when(ws.isOpen()).thenReturn(true);

    handler.handleTransportError(ws, new IOException("transport error"));

    verify(sessionManager).closeSession(sessionId);
    verify(ws).close(CloseStatus.SERVER_ERROR);
  }

  @Test
  void handleTransportError_noSession_closesWebSocket() throws Exception {
    when(ws.isOpen()).thenReturn(true);

    handler.handleTransportError(ws, new IOException("transport error"));

    verify(sessionManager, never()).closeSession(anyString());
    verify(ws).close(CloseStatus.SERVER_ERROR);
  }

  @Test
  void handleTransportError_sessionClosed_doesNotCloseAgain() throws Exception {
    when(ws.isOpen()).thenReturn(false);

    handler.handleTransportError(ws, new IOException("transport error"));

    verify(ws, never()).close(any());
  }

  @Test
  void readOutput_sendsOutputToWebSocket() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    byte[] data = "hello\n".getBytes();
    TerminalSession session = mock(TerminalSession.class);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream(data));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    CountDownLatch latch = new CountDownLatch(1);
    doThrow(new RuntimeException()).doAnswer(inv -> { latch.countDown(); return null; })
        .when(ws).close(any(CloseStatus.class));
    when(ws.isOpen()).thenReturn(true);

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws).sendMessage(new TextMessage("hello\n"));
  }

  @Test
  void readOutput_closedWebSocket_stopsReading() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mock(TerminalSession.class);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream("data".getBytes()));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    when(ws.isOpen()).thenReturn(false);
    CountDownLatch latch = new CountDownLatch(1);
    doAnswer(inv -> { latch.countDown(); return null; }).when(ws).close(any(CloseStatus.class));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws, never()).sendMessage(any(TextMessage.class));
  }

  @Test
  void trySend_illegalState_returnsFalse() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mock(TerminalSession.class);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream("hi".getBytes()));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    when(ws.isOpen()).thenReturn(true);
    CountDownLatch latch = new CountDownLatch(1);
    doThrow(new IllegalStateException("closed"))
        .doAnswer(inv -> { latch.countDown(); return null; })
        .when(ws).sendMessage(any(TextMessage.class));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws).sendMessage(any(TextMessage.class));
  }

  @Test
  void tryCloseWebSocket_ioException_ignored() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mock(TerminalSession.class);
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    when(ws.isOpen()).thenReturn(true);
    CountDownLatch latch = new CountDownLatch(1);
    doAnswer(inv -> { latch.countDown(); throw new IOException("closed"); })
        .when(ws).close(any(CloseStatus.class));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws).close(CloseStatus.NORMAL);
  }

  @Test
  void handleTextMessage_resize_illegalArgument_ignored() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    doThrow(new IllegalArgumentException("bad size"))
        .when(sessionManager).resizeSession(anyString(), anyInt(), anyInt());

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    verify(sessionManager).resizeSession(sessionId, 120, 40);
  }

  @Test
  void readOutput_drainsRemainingDataAfterEof() throws Exception {
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mock(TerminalSession.class);
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    java.io.InputStream customIn = new java.io.InputStream() {
      private int readCount = 0;

      @Override
      public int read() {
        return -1;
      }

      @Override
      public int read(final byte[] b, final int off, final int len) {
        if (readCount == 0) {
          readCount++;
          b[0] = 'X';
          return 1;
        }
        return -1;
      }

      @Override
      public int available() {
        return readCount == 1 ? 1 : 0;
      }
    };
    when(session.getInputStream()).thenReturn(customIn);
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    when(ws.isOpen()).thenReturn(true);
    CountDownLatch latch = new CountDownLatch(1);
    doAnswer(inv -> { latch.countDown(); return null; }).when(ws).close(any(CloseStatus.class));

    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws).sendMessage(new TextMessage("X"));
  }

  @Test
  void resolveShellCommand_windows_returnsCmdExe() throws Exception {
    String original = System.getProperty("os.name");
    System.setProperty("os.name", "Windows 10");
    try {
      TerminalWebSocketHandler winHandler = new TerminalWebSocketHandler(sessionManager);
      String sessionId = "sess-win";
      when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
          .thenReturn(sessionId);
      TerminalSession session = mockSession();
      when(sessionManager.getSession(sessionId)).thenReturn(session);

      winHandler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

      verify(sessionManager).createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24));
    } finally {
      System.setProperty("os.name", original);
    }
  }
}
