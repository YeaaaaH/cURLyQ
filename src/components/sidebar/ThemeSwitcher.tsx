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
import { useTheme, type ThemeName } from "@/components/ThemeProvider";

// Not persisted yet — resets to light on reload.
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  function handleThemeChange(value: string) {
    setTheme(value as ThemeName);
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
          <DropdownMenuRadioItem value="terminal">
            <SquareTerminal className="size-3.5" />
            Terminal
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
