export function LiveIndicator({ connected = false }: { connected?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono-nums">
      <span
        className={
          connected
            ? "size-1.5 rounded-full bg-accent animate-pulse-live"
            : "size-1.5 rounded-full bg-muted-foreground"
        }
      />
      <span className={connected ? "text-accent" : "text-muted-foreground"}>
        {connected ? "AO VIVO" : "OFFLINE"}
      </span>
    </div>
  );
}
