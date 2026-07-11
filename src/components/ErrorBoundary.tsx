import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UI } from '../lib/colors';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Screen-level error boundary: a thrown render error shows a branded
 * recovery screen instead of a white screen / red box. "Try again" remounts
 * the subtree; state-driven crashes get a fresh start.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  /** bumping the key remounts children from scratch */
  private generation = 0;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // demo build: log locally. Roadmap infra/crash-telemetry wires Sentry here.
    console.warn('ErrorBoundary caught', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.screen}>
          <View style={styles.mark}>
            <View style={styles.markDot} />
          </View>
          <Text style={styles.title}>Something broke on our side</Text>
          <Text style={styles.sub}>
            The session is still running — this screen just crashed. Try again to reload it.
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => {
              this.generation++;
              this.setState({ error: null });
            }}
          >
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
          <Text style={styles.detail} numberOfLines={2}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return <React.Fragment key={this.generation}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: UI.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderTopLeftRadius: 7,
    borderWidth: 3.5,
    borderColor: UI.brand,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    marginBottom: 8,
  },
  markDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: UI.brand },
  title: { color: UI.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  sub: { color: UI.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  btnText: { color: UI.bg, fontSize: 15, fontWeight: '700' },
  detail: { color: UI.textDim, fontSize: 11, marginTop: 14, opacity: 0.7, textAlign: 'center' },
});
