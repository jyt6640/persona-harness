export function signalExitCode(signal: NodeJS.Signals | null): number {
  if (signal === null) {
    return 1
  }
  const signalCodeByName: Readonly<Partial<Record<NodeJS.Signals, number>>> = {
    SIGABRT: 6,
    SIGALRM: 14,
    SIGBREAK: 21,
    SIGBUS: 7,
    SIGCHLD: 17,
    SIGCONT: 18,
    SIGFPE: 8,
    SIGHUP: 1,
    SIGILL: 4,
    SIGINT: 2,
    SIGIO: 29,
    SIGIOT: 6,
    SIGKILL: 9,
    SIGPIPE: 13,
    SIGPOLL: 29,
    SIGPROF: 27,
    SIGPWR: 30,
    SIGQUIT: 3,
    SIGSEGV: 11,
    SIGSTKFLT: 16,
    SIGSTOP: 19,
    SIGSYS: 31,
    SIGTERM: 15,
    SIGTRAP: 5,
    SIGTSTP: 20,
    SIGTTIN: 21,
    SIGTTOU: 22,
    SIGUNUSED: 31,
    SIGURG: 23,
    SIGUSR1: 10,
    SIGUSR2: 12,
    SIGVTALRM: 26,
    SIGWINCH: 28,
    SIGXCPU: 24,
    SIGXFSZ: 25,
  }
  return 128 + (signalCodeByName[signal] ?? 1)
}
