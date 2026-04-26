package su.povolzhye.code2ai.termipus.terminal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/**
 * Unit-тесты для PtyTerminalSession.
 * Проверяют создание PTY процесса, работу с потоками, изменение размера,
 * завершение процесса и получение PID.
 */
class PtyTerminalSessionTest {

  private PtyTerminalSession session;

  /**
   * Закрывает сессию после каждого теста, чтобы не оставлять висячие процессы.
   */
  @AfterEach
  void tearDown() {
    if (session != null) {
      session.close();
    }
  }

  /**
   * Возвращает команду для тестов, которым нужен долгоживущий процесс (не требует ввода-вывода).
   * Использует 'sh -c sleep infinity', что гарантированно работает в любом Unix-подобном окружении.
   *
   * @return массив команд
   */
  private String[] getLiveProcessCommand() {
    // Пропускаем тесты на Windows, так как pty4j требует Unix-подобную среду
    assumeFalse(System.getProperty("os.name").toLowerCase().contains("win"),
        "Skipping on Windows because pty4j requires Unix-like environment");
    return new String[]{"sh", "-c", "sleep infinity"};
  }

  /**
   * Возвращает команду для теста двусторонней связи – запускает оболочку.
   * Это позволяет отправлять команды и читать вывод, затем завершать сессию.
   *
   * @return массив команд для оболочки
   */
  private String[] getShellCommand() {
    assumeFalse(System.getProperty("os.name").toLowerCase().contains("win"),
        "Skipping on Windows because pty4j requires Unix-like environment");
    return new String[]{"/bin/sh", "-i"};
  }

  @Test
  void constructor_shouldCreateAliveProcess() throws Exception {
    // Подготовка: команда, которая не завершается (sleep infinity)
    String[] command = getLiveProcessCommand();

    // Действие: создаём сессию
    session = new PtyTerminalSession(command, null, null, 80, 24);

    // Проверка: процесс должен быть жив
    assertThat(session.isAlive()).isTrue();
    // PID должен быть положительным числом
    assertThat(session.getPid()).isGreaterThan(0);
  }

  @Test
  void getInputStream_shouldReturnNonNull() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 80, 24);

    // Проверка: входной поток не null
    assertThat(session.getInputStream()).isNotNull();
  }

  @Test
  void getOutputStream_shouldReturnNonNull() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 80, 24);

    // Проверка: выходной поток не null
    assertThat(session.getOutputStream()).isNotNull();
  }

  @Test
  void getErrorStream_shouldReturnNonNull() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 80, 24);

    // Проверка: поток ошибок не null (возвращается пустой поток)
    assertThat(session.getErrorStream()).isNotNull();
  }

  @Test
  void resize_shouldChangeTerminalSizeWithoutException() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 40, 20);
    assertThat(session.isAlive()).isTrue();

    // Действие: изменяем размер
    session.resize(100, 30);

    // Проверка: процесс остался жив (исключений нет)
    assertThat(session.isAlive()).isTrue();

    // Повторный resize с другими параметрами
    session.resize(120, 40);
    assertThat(session.isAlive()).isTrue();
  }

  @Test
  void close_shouldTerminateProcess() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 80, 24);
    assertThat(session.isAlive()).isTrue();

    // Действие: закрываем
    session.close();

    // Проверка: процесс завершён (метод close сам дожидается завершения)
    assertThat(session.isAlive()).isFalse();
  }

  @Test
  void getPid_returnsPidOfRunningProcess() throws Exception {
    // Подготовка: создаём сессию
    session = new PtyTerminalSession(getLiveProcessCommand(), null, null, 80, 24);

    // Проверка: PID > 0
    assertThat(session.getPid()).isGreaterThan(0);
  }

  @Test
  @Timeout(value = 5, unit = TimeUnit.SECONDS) // общий таймаут на весь тест
  void inputOutputCommunication_shouldWork() throws Exception {
    // Подготовка: создаём сессию с интерактивной оболочкой для проверки двусторонней связи
    session = new PtyTerminalSession(getShellCommand(), null, null, 80, 24);
    assertThat(session.isAlive()).isTrue();

    InputStream in = session.getInputStream();
    OutputStream out = session.getOutputStream();

    // Буфер для накопления вывода (используем AtomicReference для потокобезопасности)
    AtomicReference<StringBuilder> outputRef = new AtomicReference<>(new StringBuilder());
    // Счётчик для сигнала о том, что ожидаемое слово "hello" найдено в выводе
    CountDownLatch helloDetected = new CountDownLatch(1);
    // Счётчик для сигнала о том, что оболочка вывела приглашение и готова к приёму команд
    CountDownLatch shellReady = new CountDownLatch(1);

    // Запускаем поток чтения вывода терминала
    Thread readerThread = new Thread(() -> {
      byte[] buffer = new byte[8192];
      try {
        int bytesRead;
        boolean firstOutput = true;
        while ((bytesRead = in.read(buffer)) != -1) {
          String chunk = new String(buffer, 0, bytesRead);
          // Добавляем прочитанные данные в общий буфер
          outputRef.get().append(chunk);
          // Если это первый прочитанный блок, значит оболочка выдала приглашение – сигнализируем
          if (firstOutput) {
            firstOutput = false;
            shellReady.countDown();
          }
          // Если в выводе появилось слово "hello" – уменьшаем счётчик (сигнал)
          if (outputRef.get().indexOf("hello") != -1) {
            helloDetected.countDown();
          }
        }
      } catch (java.io.IOException ignored) {
        // Нормальное завершение при закрытии потока
      }
    });
    readerThread.setDaemon(true);
    readerThread.start();

    // Ожидаем появления первого вывода (приглашения оболочки) – максимум 2 секунды
    boolean ready = shellReady.await(2, TimeUnit.SECONDS);
    assertThat(ready)
        .as("Оболочка должна вывести приглашение в течение 2 секунд")
        .isTrue();

    // Действие: отправляем команду echo hello
    out.write("echo hello\n".getBytes());
    out.flush();

    // Ожидаем появления "hello" в выводе (максимум 2 секунды)
    boolean helloReceived = helloDetected.await(2, TimeUnit.SECONDS);
    assertThat(helloReceived)
        .as("Вывод терминала должен содержать 'hello' после выполнения echo hello")
        .isTrue();

    // Отправляем команду exit для штатного завершения оболочки
    out.write("exit\n".getBytes());
    out.flush();

    // Ждём завершения процесса (максимум 1 секунда)
    long deadline = System.currentTimeMillis() + 1000;
    while (session.isAlive() && System.currentTimeMillis() < deadline) {
      Thread.onSpinWait();
    }

    // Закрываем выходной поток, чтобы прервать чтение (in.read вернёт -1)
    out.close();

    // Дожидаемся завершения потока чтения (максимум 1 секунда)
    readerThread.join(1000);

    // Дополнительная проверка: результирующий вывод содержит "hello" (на всякий случай)
    assertThat(outputRef.get().toString()).contains("hello");
  }
}
