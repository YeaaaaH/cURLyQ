import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

const appWindow = getCurrentWindow();

// Native decorations are off (see tauri.conf.json) so the whole caption row —
// drag region, minimize/maximize/close — is drawn here instead, using the
// same theme tokens as the rest of the app. That's the only way the frame
// can follow the `terminal` theme's distinct palette/sharp corners, which
// Tauri's native `setTheme` (light/dark only, OS-drawn chrome) can't do.
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={() => appWindow.toggleMaximize()}
      className="fixed inset-x-0 top-0 z-50 flex h-8 shrink-0 select-none items-center justify-between border-b border-sidebar-border bg-sidebar"
    >
      <div data-tauri-drag-region className="h-full flex-1" />
      <div className="flex h-full">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => appWindow.minimize()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={isMaximized ? "Restore" : "Maximize"}
          onClick={() => appWindow.toggleMaximize()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {isMaximized ? <Copy className={cn("size-3", "-scale-x-100")} /> : <Square className="size-3" />}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => appWindow.close()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
