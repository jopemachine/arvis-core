export enum LogType {
  info,
  silly,
  debug,
  verbose,
  warn,
  error,
}

export const defaultLogLevels: LogType[] = [LogType.debug, LogType.error, LogType.info];

let logLevels: LogType[] = defaultLogLevels;

/**
 * Print out the logs that are included in the "types".
 * @param types
 */
export const setLogLevels = (types: LogType[]): void => {
  logLevels = types;
};

/**
 * @param type
 * @param message
 * @param optionalParams optionalParams of console.log, console.error
 */
export const log = (type: LogType, message?: any, ...optionalParams: any[]): void => {
  if (type === LogType.error) {
    console.error(message, ...optionalParams);
  } else if (type === LogType.warn) {
    console.warn(message, ...optionalParams);
  } else if (logLevels.includes(type)) {
    console.log(message, ...optionalParams);
  }
};

/**
 * @param type
 * @param groupName
 */
export const group = (type: LogType, groupName: string) => {
  if (logLevels.includes(type)) {
    console.group(groupName);
  }
};

/**
 */
export const groupEnd = () => {
  console.groupEnd();
};

/**
 * @param err
 */
export const trace = (err: Error): void => {
  if (logLevels.includes(LogType.error)) {
    console.trace(err);
  }
};
