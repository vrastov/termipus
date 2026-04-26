package su.povolzhye.code2ai.termipus.terminal;

/**
 * Исключение, возникающее при ошибке создания PTY сессии.
 */
public class SessionCreationException extends RuntimeException {

  /**
   * Создаёт исключение с сообщением и причиной.
   *
   * @param message описание ошибки
   * @param cause   исходное исключение
   */
  public SessionCreationException(final String message, final Throwable cause) {
    super(message, cause);
  }
}
