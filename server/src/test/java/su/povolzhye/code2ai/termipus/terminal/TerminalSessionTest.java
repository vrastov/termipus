package su.povolzhye.code2ai.termipus.terminal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.pty4j.PtyProcess;
import com.pty4j.WinSize;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.Test;

class TerminalSessionTest {

  private final PtyProcess process = mock(PtyProcess.class);
  private final TerminalSession session = new TerminalSession("test-id", process);

  @Test
  void getId_returnsId() {
    assertEquals("test-id", session.getId());
  }

  @Test
  void isAlive_delegatesToProcess() {
    when(process.isAlive()).thenReturn(true);
    assertTrue(session.isAlive());
  }

  @Test
  void getInputStream_returnsProcessInputStream() {
    when(process.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
    assertNotNull(session.getInputStream());
  }

  @Test
  void getOutputStream_returnsProcessOutputStream() {
    when(process.getOutputStream()).thenReturn(new ByteArrayOutputStream());
    assertNotNull(session.getOutputStream());
  }

  @Test
  void resize_setsWinSize() {
    session.resize(120, 40);
    verify(process).setWinSize(new WinSize(120, 40));
  }

  @Test
  void close_destroysProcess() {
    session.close();
    verify(process).destroy();
  }
}
