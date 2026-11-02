import { Platform } from "react-native";

export const COLORS = {
  bg: "var(--bg, #F8FAFC)",
  bgMobile: "var(--bg-mobile, #F1F5F9)",
  primary: "var(--primary, #BE123C)",
  primaryDark: "var(--primary-dark, #9F1239)",
  primarySoft: "var(--primary-soft, #FFF1F2)",
  text: "var(--text, #0F172A)",
  muted: "var(--muted, #64748B)",
  textSoft: "var(--text-soft, #475569)",
  card: "var(--card, #FFFFFF)",
  border: "var(--border, #E2E8F0)",
  successBg: "var(--success-bg, #ECFDF5)",
  success: "var(--success, #059669)",
  successBorder: "var(--success-border, #A7F3D0)",
  danger: "var(--danger, #DC2626)",
  dangerSoft: "var(--danger-soft, #FEF2F2)",
  warning: "var(--warning, #D97706)",
  warningBg: "var(--warning-bg, #FFFBEB)",
  warningBorder: "var(--warning-border, #FDE68A)",
  info: "var(--info, #2563EB)",
  infoBg: "var(--info-bg, #EFF6FF)",
  infoBorder: "var(--info-border, #BFDBFE)",
  teal: "var(--teal, #0D9488)",
  tealBg: "var(--teal-bg, #F0FDFA)",
  tealBorder: "var(--teal-border, #99F6E4)",
  betaBg: "var(--beta-bg, #F5F3FF)",
  betaBorder: "var(--beta-border, #DDD6FE)",
  betaText: "var(--beta-text, #6D28D9)",
  betaTextSoft: "var(--beta-text-soft, #7C3AED)",
  betaBadgeBg: "var(--beta-badge-bg, #EDE9FE)",
  betaFilePickerBg: "var(--beta-file-picker-bg, #F5F3FF)",
  betaFilePickerText: "var(--beta-file-picker-text, #4C1D95)",
  betaDivider: "var(--beta-divider, #E9D5FF)",
  betaBtnDisabled: "var(--beta-btn-disabled, #C4B5FD)",
};

export const THEME = {
  fontSize: {
    xs: 12,
    sm: 13.5,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999,
  },
  colors: {
    ...COLORS,
    surface: COLORS.card,
  },
  shadow: {
    web: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    soft: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
  },
} as const;

export function applyTheme(mode: "light" | "dark") {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;

  if (mode === "dark") {
    root.style.setProperty("--bg", "#09090B");
    root.style.setProperty("--bg-mobile", "#09090B");
    root.style.setProperty("--card", "#121215");
    root.style.setProperty("--border", "#27272A");
    root.style.setProperty("--text", "#F4F4F5");
    root.style.setProperty("--muted", "#A1A1AA");
    root.style.setProperty("--text-soft", "#A1A1AA");

    root.style.setProperty("--primary", "#E11D48");
    root.style.setProperty("--primary-dark", "#BE123C");
    root.style.setProperty("--primary-soft", "rgba(225, 29, 72, 0.14)");

    root.style.setProperty("--success-bg", "rgba(16, 185, 129, 0.12)");
    root.style.setProperty("--success", "#10B981");
    root.style.setProperty("--success-border", "rgba(16, 185, 129, 0.28)");

    root.style.setProperty("--danger", "#EF4444");
    root.style.setProperty("--danger-soft", "rgba(239, 68, 68, 0.14)");

    root.style.setProperty("--warning", "#F59E0B");
    root.style.setProperty("--warning-bg", "rgba(245, 158, 11, 0.12)");
    root.style.setProperty("--warning-border", "rgba(245, 158, 11, 0.28)");

    root.style.setProperty("--info", "#38BDF8");
    root.style.setProperty("--info-bg", "rgba(56, 189, 248, 0.12)");
    root.style.setProperty("--info-border", "rgba(56, 189, 248, 0.28)");

    root.style.setProperty("--teal", "#14B8A6");
    root.style.setProperty("--teal-bg", "rgba(20, 184, 166, 0.12)");
    root.style.setProperty("--teal-border", "rgba(20, 184, 166, 0.28)");

    root.style.setProperty("--beta-bg", "#181326");
    root.style.setProperty("--beta-border", "#4C1D95");
    root.style.setProperty("--beta-text", "#C4B5FD");
    root.style.setProperty("--beta-text-soft", "#A78BFA");
    root.style.setProperty("--beta-badge-bg", "#2E1065");
    root.style.setProperty("--beta-file-picker-bg", "#1E1B4B");
    root.style.setProperty("--beta-file-picker-text", "#DDD6FE");
    root.style.setProperty("--beta-divider", "#3B0764");
    root.style.setProperty("--beta-btn-disabled", "#4C1D95");
  } else {
    root.style.setProperty("--bg", "#F8FAFC");
    root.style.setProperty("--bg-mobile", "#F1F5F9");
    root.style.setProperty("--card", "#FFFFFF");
    root.style.setProperty("--border", "#E2E8F0");
    root.style.setProperty("--text", "#0F172A");
    root.style.setProperty("--muted", "#64748B");
    root.style.setProperty("--text-soft", "#475569");

    root.style.setProperty("--primary", "#BE123C");
    root.style.setProperty("--primary-dark", "#9F1239");
    root.style.setProperty("--primary-soft", "#FFF1F2");

    root.style.setProperty("--success-bg", "#ECFDF5");
    root.style.setProperty("--success", "#059669");
    root.style.setProperty("--success-border", "#A7F3D0");

    root.style.setProperty("--danger", "#DC2626");
    root.style.setProperty("--danger-soft", "#FEF2F2");

    root.style.setProperty("--warning", "#D97706");
    root.style.setProperty("--warning-bg", "#FFFBEB");
    root.style.setProperty("--warning-border", "#FDE68A");

    root.style.setProperty("--info", "#2563EB");
    root.style.setProperty("--info-bg", "#EFF6FF");
    root.style.setProperty("--info-border", "#BFDBFE");

    root.style.setProperty("--teal", "#0D9488");
    root.style.setProperty("--teal-bg", "#F0FDFA");
    root.style.setProperty("--teal-border", "#99F6E4");

    root.style.setProperty("--beta-bg", "#F5F3FF");
    root.style.setProperty("--beta-border", "#DDD6FE");
    root.style.setProperty("--beta-text", "#6D28D9");
    root.style.setProperty("--beta-text-soft", "#7C3AED");
    root.style.setProperty("--beta-badge-bg", "#EDE9FE");
    root.style.setProperty("--beta-file-picker-bg", "#F5F3FF");
    root.style.setProperty("--beta-file-picker-text", "#4C1D95");
    root.style.setProperty("--beta-divider", "#E9D5FF");
    root.style.setProperty("--beta-btn-disabled", "#C4B5FD");
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", mode === "dark" ? "#09090B" : "#F8FAFC");
  }

  root.style.colorScheme = mode;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function getSavedTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem("theme_mode");
    if (saved === "dark" || saved === "light") {
      return saved;
    }
  }
  return "light";
}

export function saveTheme(mode: "light" | "dark") {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem("theme_mode", mode);
  }
}
