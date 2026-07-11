import '../src/lib/polyfills';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ErrorToastHost } from '../src/components/ErrorToast';
import { UI } from '../src/lib/colors';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: UI.bg },
        }}
      />
      <ErrorToastHost />
    </ErrorBoundary>
  );
}
