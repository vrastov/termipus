package su.povolzhye.code2ai.termipus.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** Registers WebSocket handlers for the application. */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private final TerminalWebSocketHandler handler;

  /**
   * Creates the config with the given terminal handler.
   *
   * @param handler the WebSocket handler for terminal connections
   */
  public WebSocketConfig(TerminalWebSocketHandler handler) {
    this.handler = handler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(handler, "/terminal")
        .setAllowedOriginPatterns("chrome-extension://*", "moz-extension://*");
  }
}
