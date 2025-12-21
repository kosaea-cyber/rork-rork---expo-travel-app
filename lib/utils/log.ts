export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

const isProd = !__DEV__;

function shouldLog(level: LogLevel) {
  const override = process.env.EXPO_PUBLIC_LOG_LEVEL;
  if (override === 'debug') return true;
  if (override === 'info') return level !== 'debug';
  if (override === 'warn') return level === 'warn' || level === 'error';
  if (override === 'error') return level === 'error';
  if (override === 'silent') return false;

  if (!isProd) return true;
  return level === 'warn' || level === 'error';
}

function format(message: string, meta?: Record<string, unknown>) {
  if (!meta) return message;
  try {
    return `${message} ${JSON.stringify(meta)}`;
  } catch {
    return message;
  }
}

export const log: Logger = {
  debug: (message, meta) => {
    if (!shouldLog('debug')) return;
    console.log(format(message, meta));
  },
  info: (message, meta) => {
    if (!shouldLog('info')) return;
    console.log(format(message, meta));
  },
  warn: (message, meta) => {
    if (!shouldLog('warn')) return;
    console.warn(format(message, meta));
  },
  error: (message, meta) => {
    if (!shouldLog('error')) return;
    console.error(format(message, meta));
  },
};
