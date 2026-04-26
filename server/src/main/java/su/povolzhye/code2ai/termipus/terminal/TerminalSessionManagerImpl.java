package su.povolzhye.code2ai.termipus.terminal;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Реализация менеджера PTY сессий с потокобезопасным хранением.
 */
@Service
public final class TerminalSessionManagerImpl
    implements TerminalSessionManager {

  /** Хранилище сессий: идентификатор -&gt; сессия. */
  private final Map<String, TerminalSession> sessions =
      new ConcurrentHashMap<>();

  @Override
  public String createSession(
      final String[] command,
      final String directory,
      final Map<String, String> environment,
      final int cols,
      final int rows) throws SessionCreationException {
    try {
      PtyTerminalSession session =
          new PtyTerminalSession(command, directory, environment, cols, rows);
      String sessionId = generateSessionId(session);
      sessions.put(sessionId, session);
      return sessionId;
    } catch (Exception e) {
      throw new SessionCreationException(
          "Failed to create PTY session for command: "
              + String.join(" ", command),
          e);
    }
  }

  /**
   * Генерирует идентификатор на основе PID или UUID.
   *
   * @param session сессия, для которой генерируется идентификатор
   * @return строковый идентификатор сессии
   */
  private String generateSessionId(final PtyTerminalSession session) {
    long pid = session.getPid();
    if (pid > 0) {
      return String.valueOf(pid);
    }
    return UUID.randomUUID().toString();
  }

  @Override
  public TerminalSession getSession(final String sessionId) {
    return sessions.get(sessionId);
  }

  @Override
  public void closeSession(final String sessionId) {
    TerminalSession session = sessions.remove(sessionId);
    if (session != null) {
      session.close();
    }
  }

  @Override
  public void resizeSession(
      final String sessionId, final int cols, final int rows) {
    TerminalSession session = sessions.get(sessionId);
    if (session == null) {
      throw new IllegalArgumentException("Session not found: " + sessionId);
    }
    session.resize(cols, rows);
  }

  @Override
  public boolean hasSession(final String sessionId) {
    return sessions.containsKey(sessionId);
  }

  @Override
  public Map<String, TerminalSession> getActiveSessions() {
    return Collections.unmodifiableMap(sessions);
  }

  @Override
  public void closeAllSessions() {
    for (Map.Entry<String, TerminalSession> entry : sessions.entrySet()) {
      entry.getValue().close();
    }
    sessions.clear();
  }
}
