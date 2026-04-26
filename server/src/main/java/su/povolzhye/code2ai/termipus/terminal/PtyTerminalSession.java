package su.povolzhye.code2ai.termipus.terminal;

import com.pty4j.PtyProcess;
import com.pty4j.WinSize;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Реализация TerminalSession на основе PtyProcess из библиотеки pty4j.
 */
public final class PtyTerminalSession implements TerminalSession {

  /** Управляемый PTY процесс. */
  private final PtyProcess process;

  /**
   * Создаёт новую PTY сессию.
   *
   * @param command     команда и аргументы (например, {"/bin/sh", "-l"})
   * @param directory   рабочая директория процесса
   * @param environment переменные окружения (null — системные)
   * @param cols        начальное количество колонок
   * @param rows        начальное количество строк
   * @throws IOException если не удалось запустить процесс
   */
  public PtyTerminalSession(
      final String[] command,
      final String directory,
      final Map<String, String> environment,
      final int cols,
      final int rows) throws IOException {
    com.pty4j.PtyProcessBuilder builder =
        new com.pty4j.PtyProcessBuilder(command);
    builder.setDirectory(directory);

    Map<String, String> effectiveEnv = new HashMap<>();
    if (environment != null) {
      effectiveEnv.putAll(environment);
    } else {
      effectiveEnv.putAll(System.getenv());
    }
    if (!effectiveEnv.containsKey("TERM")) {
      effectiveEnv.put("TERM", "xterm-256color");
    }
    builder.setEnvironment(effectiveEnv);
    builder.setInitialColumns(cols);
    builder.setInitialRows(rows);
    builder.setRedirectErrorStream(true);
    this.process = builder.start();
  }

  @Override
  public InputStream getInputStream() {
    return process.getInputStream();
  }

  @Override
  public OutputStream getOutputStream() {
    return process.getOutputStream();
  }

  @Override
  public InputStream getErrorStream() {
    return new ByteArrayInputStream(new byte[0]);
  }

  @Override
  public void resize(final int cols, final int rows) {
    if (process.isAlive()) {
      process.setWinSize(new WinSize(cols, rows));
    }
  }

  @Override
  public void close() {
    try {
      process.getOutputStream().close();
    } catch (IOException ignored) {
      // поток уже мог быть закрыт
    }
    try {
      process.getInputStream().close();
    } catch (IOException ignored) {
      // поток уже мог быть закрыт
    }
    process.destroy();
    try {
      if (!process.waitFor(1, TimeUnit.SECONDS)) {
        process.destroyForcibly();
        process.waitFor(1, TimeUnit.SECONDS);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      process.destroyForcibly();
    }
  }

  @Override
  public boolean isAlive() {
    return process.isAlive();
  }

  @Override
  public long getPid() {
    return process.pid();
  }
}
