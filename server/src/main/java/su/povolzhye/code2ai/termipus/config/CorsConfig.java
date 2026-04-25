package su.povolzhye.code2ai.termipus.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Configures CORS to allow requests from browser extension origins. */
@Configuration
public class CorsConfig {

  /**
   * Returns a {@link WebMvcConfigurer} that permits extension and localhost origins.
   *
   * @return the CORS configurer
   */
  @Bean
  public WebMvcConfigurer corsConfigurer() {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns(
                "chrome-extension://*", "moz-extension://*", "http://localhost:*")
            .allowedMethods("GET", "POST", "OPTIONS");
      }
    };
  }
}
