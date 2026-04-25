package su.povolzhye.code2ai.termipus.terminal;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** Manages active {@link TerminalSession} instances. */
@Service
public class TerminalSessionManager {

  private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();

  /**
   * Creates a new PTY session with the given terminal dimensions.
   *
   * @param cols number of columns
   * @param rows number of rows
   * @return the created session
   * @throws IOException if the PTY process cannot be started
   */
  public TerminalSession create(int cols, int rows) throws IOException {
    PtyProcess process = new PtyProcessBuilder()
        .setCommand(resolveShell())
        .setEnvironment(System.getenv())
        .setInitialColumns(cols)
        .setInitialRows(rows)
        .start();

    String id = UUID.randomUUID().toString();
    TerminalSession session = new TerminalSession(id, process);
    sessions.put(id, session);
    return session;
  }

  /**
   * Returns the session with the given id, or {@code null} if not found.
   *
   * @param id session identifier
   * @return the session, or {@code null}
   */
  public TerminalSession get(String id) {
    return sessions.get(id);
  }

  /**
   * Closes and removes the session with the given id.
   *
   * @param id session identifier
   */
  public void close(String id) {
    TerminalSession session = sessions.remove(id);
    if (session != null) {
      session.close();
    }
  }

  private String[] resolveShell() {
    if (System.getProperty("os.name").toLowerCase().contains("win")) {
      return new String[]{"cmd.exe"};
    }
    return new String[]{System.getenv().getOrDefault("SHELL", "/bin/bash")};
  }
}
