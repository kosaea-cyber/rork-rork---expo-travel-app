import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Colors from '@/constants/colors';
import { log } from '@/lib/utils/log';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryKey: number;
};

export class ErrorBoundary extends React.PureComponent<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    log.error('[ErrorBoundary] uncaught error', {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
      componentStack: errorInfo.componentStack ?? null,
    });
  }

  private retry = () => {
    log.info('[ErrorBoundary] retry requested');
    this.setState((prev) => ({
      error: null,
      errorInfo: null,
      retryKey: prev.retryKey + 1,
    }));
  };

  private report = async () => {
    const subject = encodeURIComponent('App issue report');
    const body = encodeURIComponent(
      `Please describe what happened:\n\n\n---\nDebug info:\n${
        this.state.error?.message ?? 'Unknown error'
      }\n\nStack:\n${this.state.error?.stack ?? 'n/a'}\n\nComponent stack:\n${
        this.state.errorInfo?.componentStack ?? 'n/a'
      }\n`
    );

    const email = 'info@ruwasielite.com';
    const url = `mailto:${email}?subject=${subject}&body=${body}`;

    try {
      await Linking.openURL(url);
    } catch (e) {
      log.error('[ErrorBoundary] report failed', { error: String(e) });
    }
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container} testID="errorBoundaryRoot">
          <View style={styles.card}>
            <Text style={styles.title} testID="errorBoundaryTitle">
              Something went wrong
            </Text>
            <Text style={styles.subtitle} testID="errorBoundarySubtitle">
              Please try again. If this keeps happening, report it.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={this.retry}
                testID="errorBoundaryRetry"
              >
                <Text style={[styles.buttonText, styles.primaryButtonText]}>Retry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={this.report}
                testID="errorBoundaryReport"
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Report</Text>
              </TouchableOpacity>
            </View>

            {__DEV__ ? (
              <Text style={styles.devDetails} testID="errorBoundaryDevDetails">
                {this.state.error.message}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.tint,
  },
  secondaryButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButtonText: {
    color: Colors.text,
  },
  devDetails: {
    marginTop: 14,
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
