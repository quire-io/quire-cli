import { isatty } from "node:tty";

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
}

export interface LoggerOptions {
  verbose?: boolean;
  /** Force color on/off; defaults to auto-detect on stderr. */
  color?: "always" | "never" | "auto";
}

function shouldColor(mode: LoggerOptions["color"]): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  if (process.env.NO_COLOR) return false;
  return isatty(2);
}

function paint(use: boolean, code: string, s: string): string {
  return use ? `\x1b[${code}m${s}\x1b[0m` : s;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const verbose = opts.verbose === true;
  const useColor = shouldColor(opts.color);
  const dim = (s: string) => paint(useColor, "2", s);
  const yellow = (s: string) => paint(useColor, "33", s);
  const red = (s: string) => paint(useColor, "31", s);

  return {
    debug(msg, ...rest) {
      if (!verbose) return;
      console.error(dim(`[debug] ${msg}`), ...rest);
    },
    info(msg, ...rest) {
      console.error(msg, ...rest);
    },
    warn(msg, ...rest) {
      console.error(yellow(`warning: ${msg}`), ...rest);
    },
    error(msg, ...rest) {
      console.error(red(`error: ${msg}`), ...rest);
    },
  };
}
