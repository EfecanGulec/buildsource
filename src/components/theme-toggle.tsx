import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

const OPTIONS: { value: Theme; icon: typeof Sun; key: string }[] = [
  { value: "light", icon: Sun, key: "theme.light" },
  { value: "dark", icon: Moon, key: "theme.dark" },
  { value: "system", icon: Monitor, key: "theme.system" },
];

/** Light / dark / system switch, rendered inside the user menu (design system D1). */
export function ThemeMenuItems() {
  const [theme, setTheme] = useTheme();
  const { t } = useI18n();
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-caption text-muted-foreground">
        {t("theme.title")}
      </DropdownMenuLabel>
      {OPTIONS.map(({ value, icon: Icon, key }) => (
        <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{t(key)}</span>
          {theme === value && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
