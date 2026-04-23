function format(args: unknown[]) {
  return args
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join(" ");
}

export const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(format(args));
    }
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(format(args));
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(format(args));
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(format(args));
    }
  },
};
