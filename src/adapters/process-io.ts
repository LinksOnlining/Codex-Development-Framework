export interface ProcessIO {
  writeStdout(message: string): void;
  writeStderr(message: string): void;
}

export const processIO: ProcessIO = {
  writeStdout(message) {
    process.stdout.write(message);
  },
  writeStderr(message) {
    process.stderr.write(message);
  },
};
