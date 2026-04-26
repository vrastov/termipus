package su.povolzhye.code2ai.termipus.terminal;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Представляет PTY сессию для управления терминальным процессом.
 */
public interface TerminalSession {

  /**
   * Возвращает входной поток для чтения вывода процесса.
   *
   * @return InputStream stdout процесса
   */
  InputStream getInputStream();

  /**
   * Возвращает выходной поток для записи команд в процесс.
   *
   * @return OutputStream stdin процесса
   */
  OutputStream getOutputStream();

  /**
   * Возвращает поток ошибок процесса.
   *
   * @return InputStream stderr процесса
   */
  InputStream getErrorStream();

  /**
   * Изменяет размер псевдо-терминала.
   *
   * @param cols количество колонок
   * @param rows количество строк
   */
  void resize(int cols, int rows);

  /**
   * Закрывает сессию: завершает процесс и освобождает ресурсы.
   */
  void close();

  /**
   * Проверяет, жив ли процесс внутри сессии.
   *
   * @return true если процесс запущен и не завершен
   */
  boolean isAlive();

  /**
   * Возвращает PID процесса (если доступен).
   *
   * @return PID или -1 если не удалось получить
   */
  long getPid();
}
