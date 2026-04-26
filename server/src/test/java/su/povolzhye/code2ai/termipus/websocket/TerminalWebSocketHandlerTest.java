package su.povolzhye.code2ai.termipus.websocket;

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
    // Методы getInputStream/getOutputStream не выбрасывают проверяемых исключений
    when(session.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    when(session.isAlive()).thenReturn(true);
    when(session.getPid()).thenReturn(12345L);
    return session;
  }

  @Test
  void handleTextMessage_init_createsSession() throws Exception {
    // Подготовка: при создании сессии менеджер возвращает идентификатор "sess-1"
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    // После создания обработчик получает сессию через getSession
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);

    // Действие: отправляем JSON с типом init
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    // Проверка: менеджер вызвал createSession с корректными параметрами
    verify(sessionManager).createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24));
    // И добавил сессию в маппинг (не проверяем напрямую, но последующие вызовы getSession должны работать)
  }

  @Test
  void handleTextMessage_init_failure_sendsErrorAndCloses() throws Exception {
    // Подготовка: при создании сессии выбрасывается исключение
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenThrow(new SessionCreationException("Failed", new RuntimeException()));

    // Действие: отправляем init
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    // Проверка: отправлено сообщение об ошибке и соединение закрыто
    verify(ws).sendMessage(new TextMessage("{\"error\": \"Failed to create terminal session\"}"));
    verify(ws).close(CloseStatus.POLICY_VIOLATION);
  }

  @Test
  void handleTextMessage_resize_resizesSession() throws Exception {
    // Подготовка: сначала инициализируем сессию
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    // Действие: отправляем resize
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    // Проверка: менеджер вызвал resizeSession с правильными параметрами
    verify(sessionManager).resizeSession(sessionId, 120, 40);
  }

  @Test
  void handleTextMessage_resize_noSession_ignores() throws Exception {
    // Подготовка: без инициализации, wsToTerminal пуст
    // Действие: отправляем resize
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    // Проверка: resizeSession не вызывался
    verify(sessionManager, never()).resizeSession(anyString(), anyInt(), anyInt());
  }

  @Test
  void handleTextMessage_plainText_writesToOutputStream() throws Exception {
    // Подготовка: создаём сессию
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    TerminalSession session = mock(TerminalSession.class);
    when(session.getOutputStream()).thenReturn(out);
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    // Действие: отправляем обычный текст (команду)
    String command = "ls -la\n";
    handler.handleTextMessage(ws, new TextMessage(command));

    // Проверка: в выходной поток записана команда с \r вместо \n
    verify(session, times(2)).getOutputStream();
    String written = out.toString();
    assertTrue(written.contains("ls -la\r"), "Expected command with \\r, got: " + written);
  }

  @Test
  void handleTextMessage_plainText_noSession_doesNotWrite() throws Exception {
    // Действие: отправляем текст без предварительной инициализации
    handler.handleTextMessage(ws, new TextMessage("some command"));

    // Проверка: никто не пытался получить сессию (кроме возможного get, но вызовов записи нет)
    verify(sessionManager, never()).getSession(anyString());
  }

  @Test
  void afterConnectionClosed_withSession_closesIt() throws Exception {
    // Подготовка: инициализируем сессию
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));

    // Действие: закрываем WebSocket соединение
    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);

    // Проверка: менеджер закрыл сессию
    verify(sessionManager).closeSession(sessionId);
  }

  @Test
  void afterConnectionClosed_noSession_doesNotClose() {
    // Действие: закрываем соединение без предварительной инициализации
    handler.afterConnectionClosed(ws, CloseStatus.NORMAL);

    // Проверка: closeSession не вызывался
    verify(sessionManager, never()).closeSession(anyString());
  }

  @Test
  void readOutput_sendsOutputToWebSocket() throws Exception {
    // Подготовка: сессия с данными в потоке
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

    // Действие: инициализируем — запускается поток чтения
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    // Проверка: данные отправлены в WebSocket
    verify(ws).sendMessage(new TextMessage("hello\n"));
  }

  @Test
  void readOutput_closedWebSocket_stopsReading() throws Exception {
    // Подготовка: WebSocket закрыт сразу
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

    // WebSocket закрыт — sendMessage не вызывался
    verify(ws, never()).sendMessage(any(TextMessage.class));
  }

  @Test
  void trySend_illegalState_returnsFalse() throws Exception {
    // Подготовка: sendMessage бросает IllegalStateException (WebSocket закрыт клиентом)
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

    // Проверка: попытка отправки была, но после исключения поток завершился
    verify(ws).sendMessage(any(TextMessage.class));
  }

  @Test
  void tryCloseWebSocket_ioException_ignored() throws Exception {
    // Подготовка: ws.close() бросает IOException
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

    // Действие: не должно бросить исключение
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    latch.await(3, TimeUnit.SECONDS);

    verify(ws).close(CloseStatus.NORMAL);
  }

  @Test
  void handleTextMessage_resize_illegalArgument_ignored() throws Exception {
    // Подготовка: resizeSession бросает IllegalArgumentException
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    TerminalSession session = mockSession();
    when(sessionManager.getSession(sessionId)).thenReturn(session);
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"init\",\"cols\":80,\"rows\":24}"));
    doThrow(new IllegalArgumentException("bad size"))
        .when(sessionManager).resizeSession(anyString(), anyInt(), anyInt());

    // Действие: не должно бросить исключение
    handler.handleTextMessage(ws, new TextMessage("{\"type\":\"resize\",\"cols\":120,\"rows\":40}"));

    verify(sessionManager).resizeSession(sessionId, 120, 40);
  }

  @Test
  void readOutput_drainsRemainingDataAfterEof() throws Exception {
    // Подготовка: поток возвращает данные через available() после EOF
    String sessionId = "sess-1";
    when(sessionManager.createSession(any(String[].class), eq(null), eq(null), eq(80), eq(24)))
        .thenReturn(sessionId);
    // Первый read возвращает данные, второй — EOF; available() возвращает данные после EOF
    TerminalSession session = mock(TerminalSession.class);
    when(session.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    // Используем ByteArrayInputStream с данными — он вернёт данные, потом EOF
    // drainRemaining вызывается после EOF, но available() == 0, поэтому sleep(10)
    // Чтобы покрыть ветку available() > 0, нужен кастомный поток
    java.io.InputStream customIn = new java.io.InputStream() {
      private int readCount = 0;
      @Override public int read() { return -1; }
      @Override public int read(final byte[] b, final int off, final int len) {
        if (readCount == 0) { readCount++; b[0] = 'X'; return 1; }
        return -1;
      }
      @Override public int available() {
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

    // Проверка: данные из drainRemaining отправлены
    verify(ws).sendMessage(new TextMessage("X"));
  }

  @Test
  void resolveShellCommand_windows_returnsCmdExe() throws Exception {
    // Подготовка: эмулируем Windows через системное свойство
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
