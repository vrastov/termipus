package su.povolzhye.code2ai.termipus;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class GreeterTest {
  @Test
  void greet_returnsHelloMessage() {
    // Создаём экземпляр тестируемого класса Greeter
    Greeter greeter = new Greeter();
    // Вызываем метод greet с именем "Termipus"
    String result = greeter.greet("Termipus");
    // Проверяем, что результат соответствует ожидаемой строке
    assertEquals("Hello, Termipus!", result);
  }
}
