export const VERSION_INTERVAL_MS = 3 * 60_000;

export function createVersionCheck({
  loadedVersion, readVersion, hidden, reload, notify,
}: {
  loadedVersion: { current: string | undefined };
  readVersion: () => Promise<string | undefined>;
  hidden: () => boolean;
  reload: () => void;
  notify: () => void;
}) {
  let disposed = false;
  let pending = false;
  let notified = false;
  return {
    dispose() { disposed = true; },
    async check() {
      if (disposed || pending) return;
      pending = true;
      try {
        const version = await readVersion();
        if (disposed || version === undefined) return;
        if (loadedVersion.current === undefined) {
          loadedVersion.current = version;
          return;
        }
        if (version === loadedVersion.current) return;
        if (hidden()) reload();
        else if (!notified) { notified = true; notify(); }
      } catch { /* Erro de rede não significa nova versão. */ }
      finally { pending = false; }
    },
  };
}