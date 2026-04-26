package su.povolzhye.code2ai.termipus.terminal;

import java.util.Map;

/**
 * Управляет жизненным циклом PTY сессий.
 */
public interface TerminalSessionManager {

  /**
   * Создает новую терминальную сессию и сохраняет её в менеджере.
   *
   * @param command команда и аргументы для запуска
   * @param directory рабочая директория (может быть null)
   * @param environment переменные окружения (может быть null)
   * @param cols количество колонок
   * @param rows количество строк
   * @return идентификатор созданной сессии
   * @throws SessionCreationException если не удалось создать сессию
   */
  String createSession(String[] command, String directory,
                       Map<String, String> environment, int cols, int rows)
          throws SessionCreationException;

  /**
   * Возвращает сессию по идентификатору.
   *
   * @param sessionId идентификатор сессии
   * @return TerminalSession или null, если сессия не найдена
   */
  TerminalSession getSession(String sessionId);

  /**
   * Закрывает и удаляет сессию из менеджера.
   *
   * @param sessionId идентификатор сессии
   */
  void closeSession(String sessionId);

  /**
   * Изменяет размер терминала для указанной сессии.
   *
   * @param sessionId идентификатор сессии
   * @param cols новое количество колонок
   * @param rows новое количество строк
   * @throws IllegalArgumentException если сессия не найдена
   */
  void resizeSession(String sessionId, int cols, int rows);

  /**
   * Проверяет, существует ли сессия с данным идентификатором.
   *
   * @param sessionId идентификатор
   * @return true если сессия существует
   */
  boolean hasSession(String sessionId);

  /**
   * Возвращает все активные сессии (копию карты идентификатор->сессия).
   *
   * @return неизменяемая копия карты сессий
   */
  Map<String, TerminalSession> getActiveSessions();

  /**
   * Закрывает все активные сессии и очищает менеджер.
   */
  void closeAllSessions();
}
