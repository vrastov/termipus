package su.povolzhye.code2ai.termipus.terminal;

import com.pty4j.PtyProcess;
import com.pty4j.WinSize;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.io.InputStream;
import java.io.OutputStream;

/** Represents a single PTY terminal session backed by a {@link PtyProcess}. */
public class TerminalSession {

  private final String id;

  // PtyProcess is an external lifecycle object and cannot be defensively copied.
  @SuppressFBWarnings("EI_EXPOSE_REP2")
  private final PtyProcess process;

  /**
   * Creates a new terminal session.
   *
   * @param id unique session identifier
   * @param process the underlying PTY process
   */
  public TerminalSession(String id, PtyProcess process) {
    this.id = id;
    this.process = process;
  }

  /** Returns the unique session identifier. */
  public String getId() {
    return id;
  }

  /** Returns the input stream of the PTY process (terminal output). */
  public InputStream getInputStream() {
    return process.getInputStream();
  }

  /** Returns the output stream of the PTY process (terminal input). */
  public OutputStream getOutputStream() {
    return process.getOutputStream();
  }

  /** Returns {@code true} if the PTY process is still running. */
  public boolean isAlive() {
    return process.isAlive();
  }

  /**
   * Resizes the terminal window.
   *
   * @param cols number of columns
   * @param rows number of rows
   */
  public void resize(int cols, int rows) {
    process.setWinSize(new WinSize(cols, rows));
  }

  /** Destroys the PTY process. */
  public void close() {
    process.destroy();
  }
}
