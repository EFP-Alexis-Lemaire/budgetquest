import { useThemeStore } from '../store/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';

const OPTIONS = [
  { value: 'dark',  icon: Moon,    label: 'Sombre'    },
  { value: 'light', icon: Sun,     label: 'Clair'     },
  { value: 'auto',  icon: Monitor, label: 'Auto'      },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
            theme === value
              ? 'bg-primary-600 text-white'
              : 'text-gray-400 hover:text-white'
          )}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
