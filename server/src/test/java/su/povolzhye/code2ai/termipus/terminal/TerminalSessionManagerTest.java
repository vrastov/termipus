package su.povolzhye.code2ai.termipus.terminal;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TerminalSessionManagerTest {

  private final TerminalSessionManager manager = new TerminalSessionManager();

  @Test
  void create_returnsAliveSession() throws Exception {
    TerminalSession session = manager.create(80, 24);
    assertTrue(session.isAlive());
    manager.close(session.getId());
  }

  @Test
  void close_removesSession() throws Exception {
    TerminalSession session = manager.create(80, 24);
    manager.close(session.getId());
    assertNull(manager.get(session.getId()));
  }
}
