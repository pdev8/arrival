import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UI } from '../src/lib/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: UI.bg },
        }}
      />
    </>
  );
}
