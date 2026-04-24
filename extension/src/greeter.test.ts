import { greet } from './greeter';

test('greet returns hello message', () => {
  // Вызываем функцию greet с именем "Termipus"
  const result = greet('Termipus');
  // Ожидаем строку "Hello, Termipus!"
  expect(result).toBe('Hello, Termipus!');
});
