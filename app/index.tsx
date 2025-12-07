import { Redirect } from "expo-router";

export default function Index() {
  // Перенаправляем на экран авторизации при старте приложения
  return <Redirect href="/auth" />;
}
