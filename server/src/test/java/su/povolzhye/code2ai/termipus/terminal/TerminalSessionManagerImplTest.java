package su.povolzhye.code2ai.termipus.terminal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit-тесты для TerminalSessionManagerImpl.
 * Проверяют создание, хранение, закрытие сессий и изменение размера.
 */
class TerminalSessionManagerImplTest {

  private TerminalSessionManagerImpl manager;

  @BeforeEach
  void setUp() {
    // Создаем новый менеджер перед каждым тестом
    manager = new TerminalSessionManagerImpl();
  }

  @AfterEach
  void tearDown() {
    // Закрываем все сессии после каждого теста, чтобы избежать утечки процессов
    manager.closeAllSessions();
  }

  /**
   * Возвращает команду для тестов, которым нужен долгоживущий процесс (не требует ввода-вывода).
   * Использует 'sh -c sleep infinity', что гарантированно работает в любом Unix-подобном окружении.
   *
   * @return массив команды
   */
  private String[] getLiveProcessCommand() {
    // Пропускаем тесты на Windows, так как pty4j требует Unix-подобную среду
    assumeFalse(System.getProperty("os.name").toLowerCase().contains("win"),
        "Skipping on Windows because pty4j requires Unix-like environment");
    return new String[]{"sh", "-c", "sleep infinity"};
  }

  /**
   * Возвращает команду для теста двусторонней связи – запускает оболочку.
   * Позволяет отправлять команды и проверять вывод.
   *
   * @return массив команды для оболочки
   */
  private String[] getShellCommand() {
    assumeFalse(System.getProperty("os.name").toLowerCase().contains("win"),
        "Skipping on Windows because pty4j requires Unix-like environment");
    return new String[]{"/bin/sh", "-i"};
  }

  @Test
  void createSession_shouldReturnLiveSession() throws Exception {
    // Подготовка: команда оболочки для двусторонней связи
    String[] command = getShellCommand();
    int cols = 80;
    int rows = 24;

    // Действие: создаем сессию через менеджер
    String sessionId = manager.createSession(command, null, null, cols, rows);

    // Проверка: сессия должна существовать в менеджере
    assertThat(manager.hasSession(sessionId)).isTrue();

    // Получаем сессию и проверяем, что она жива
    TerminalSession session = manager.getSession(sessionId);
    assertThat(session).isNotNull();
    assertThat(session.isAlive()).isTrue();

    InputStream in = session.getInputStream();
    OutputStream out = session.getOutputStream();

    AtomicReference<StringBuilder> outputRef =
        new AtomicReference<>(new StringBuilder());
    CountDownLatch helloDetected = new CountDownLatch(1);
    CountDownLatch shellReady = new CountDownLatch(1);

    Thread readerThread = new Thread(() -> {
      byte[] buffer = new byte[8192];
      try {
        int bytesRead;
        boolean firstOutput = true;
        while ((bytesRead = in.read(buffer)) != -1) {
          outputRef.get().append(new String(buffer, 0, bytesRead));
          if (firstOutput) {
            firstOutput = false;
            shellReady.countDown();
          }
          if (outputRef.get().indexOf("hello") != -1) {
            helloDetected.countDown();
          }
        }
      } catch (java.io.IOException ignored) {
        // нормальное завершение при закрытии потока
      }
    });
    readerThread.setDaemon(true);
    readerThread.start();

    assertThat(shellReady.await(2, TimeUnit.SECONDS))
        .as("Оболочка должна вывести приглашение в течение 2 секунд")
        .isTrue();

    out.write("echo hello\n".getBytes());
    out.flush();

    assertThat(helloDetected.await(2, TimeUnit.SECONDS))
        .as("Вывод должен содержать 'hello' после echo hello")
        .isTrue();

    out.write("exit\n".getBytes());
    out.flush();

    long deadline = System.currentTimeMillis() + 1000;
    while (session.isAlive() && System.currentTimeMillis() < deadline) {
      Thread.onSpinWait();
    }
    out.close();
    readerThread.join(1000);

    assertThat(outputRef.get().toString()).contains("hello");
  }

  @Test
  void closeSession_shouldRemoveSessionAndTerminateProcess() throws Exception {
    // Подготовка: создаем сессию с долгоживущим процессом (sleep infinity)
    String[] command = getLiveProcessCommand();
    String sessionId = manager.createSession(command, null, null, 80, 24);
    assertThat(manager.hasSession(sessionId)).isTrue();
    TerminalSession session = manager.getSession(sessionId);
    assertThat(session.isAlive()).isTrue();

    // Действие: закрываем сессию через менеджер
    manager.closeSession(sessionId);

    // Проверка: сессия удалена из менеджера
    assertThat(manager.hasSession(sessionId)).isFalse();
    assertThat(manager.getSession(sessionId)).isNull();

    // Проверка: процесс завершен (метод close внутри дожидается завершения)
    assertThat(session.isAlive()).isFalse();
  }

  @Test
  void resizeSession_shouldChangeTerminalSize() throws Exception {
    // Подготовка: создаем сессию с долгоживущим процессом
    String[] command = getLiveProcessCommand();
    int initialCols = 40;
    int initialRows = 20;
    String sessionId = manager.createSession(command, null, null, initialCols, initialRows);
    TerminalSession session = manager.getSession(sessionId);
    assertThat(session.isAlive()).isTrue();

    // Действие: изменяем размер на 100x30
    int newCols = 100;
    int newRows = 30;
    manager.resizeSession(sessionId, newCols, newRows);

    // Проверка: метод resize должен выполниться без исключений.
    // Прямой проверки размера извне нет, но можно проверить, что сессия все еще жива
    assertThat(session.isAlive()).isTrue();

    // Проверяем, что повторный вызов resize с другими значениями тоже работает
    manager.resizeSession(sessionId, 120, 40);
    assertThat(session.isAlive()).isTrue();
  }

  @Test
  void resizeSession_forInvalidId_shouldThrowException() {
    // Подготовка: несуществующий идентификатор
    String invalidId = "non-existent-session";

    // Действие и проверка: вызов resizeSession должен выбросить IllegalArgumentException
    assertThatThrownBy(() -> manager.resizeSession(invalidId, 80, 24))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Session not found");
  }

  @Test
  void getActiveSessions_shouldReturnUnmodifiableCopy() throws Exception {
    // Подготовка: создаем две сессии с долгоживущим процессом
    String[] command = getLiveProcessCommand();
    String sessionId1 = manager.createSession(command, null, null, 80, 24);
    String sessionId2 = manager.createSession(command, null, null, 80, 24);

    // Действие: получаем активные сессии
    Map<String, TerminalSession> activeSessions = manager.getActiveSessions();

    // Проверка: карта содержит оба идентификатора и неизменяема
    assertThat(activeSessions).containsOnlyKeys(sessionId1, sessionId2).isUnmodifiable();

    // Проверка: попытка модификации через getActiveSessions должна выбросить исключение
    assertThatThrownBy(activeSessions::clear)
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void closeAllSessions_shouldCloseAndClearAll() throws Exception {
    // Подготовка: создаем несколько сессий с долгоживущим процессом
    String[] command = getLiveProcessCommand();
    String sessionId1 = manager.createSession(command, null, null, 80, 24);
    String sessionId2 = manager.createSession(command, null, null, 80, 24);
    TerminalSession session1 = manager.getSession(sessionId1);
    TerminalSession session2 = manager.getSession(sessionId2);
    assertThat(session1.isAlive()).isTrue();
    assertThat(session2.isAlive()).isTrue();

    // Действие: закрываем все сессии
    manager.closeAllSessions();

    // Проверка: менеджер не содержит сессий
    assertThat(manager.getActiveSessions()).isEmpty();
    // Проверка: процессы завершены (метод close внутри дожидается завершения)
    assertThat(session1.isAlive()).isFalse();
    assertThat(session2.isAlive()).isFalse();
  }
}
