import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Palette, SquareTerminal, Sun } from "lucide-react";

// Preview only: not persisted yet, no real switcher mechanism behind it —
// just proves the token setup by actually toggling the existing `.dark` class.
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<"light" | "dark" | "terminal">("light");

  function handleThemeChange(value: string) {
    const next = value as "light" | "dark" | "terminal";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Change theme" className="ml-auto size-7">
          <Palette className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-3.5" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-3.5" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="terminal" disabled>
            <SquareTerminal className="size-3.5" />
            Terminal
            <span className="ml-auto text-xs text-muted-foreground">Soon</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
