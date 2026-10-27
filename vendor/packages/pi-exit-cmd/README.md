# pi-exit-cmd

A small [Pi](https://pi.dev) extension that adds `/exit` as a graceful exit command.

## Install

```bash
pi install npm:pi-exit-cmd
```

Restart Pi (or run `/reload`), then enter:

```text
/exit
```

Pi waits until any active work settles and then shuts down cleanly.
