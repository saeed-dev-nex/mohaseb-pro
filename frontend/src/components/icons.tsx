import type { ReactNode, SVGProps } from "react";

/**
 * Inline SVG icon set (Lucide-inspired, stroke-based, currentColor).
 * Every icon inherits its color from `currentColor` and defaults to a 1em
 * square, so it aligns with surrounding text; pass a Tailwind size class
 * (e.g. className="h-5 w-5") to scale it independently.
 */

type IconProps = SVGProps<SVGSVGElement>;

const createIcon = (children: ReactNode) => {
  const Icon = (props: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
  return Icon;
};

// ── Navigation ────────────────────────────────────────────────────────────
export const DashboardIcon = createIcon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);

export const FileTextIcon = createIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </>,
);

export const PlusIcon = createIcon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const BarChartIcon = createIcon(
  <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 16v-5" />
    <path d="M12 16V8" />
    <path d="M17 16v-3" />
  </>,
);

export const WalletIcon = createIcon(
  <>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M16 12h4v4h-4a2 2 0 0 1 0-4z" />
  </>,
);

export const BanknoteIcon = createIcon(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01" />
    <path d="M18 12h.01" />
  </>,
);

export const TicketIcon = createIcon(
  <>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </>,
);

export const ChatIcon = createIcon(
  <>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </>,
);

export const UsersIcon = createIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);

export const CogIcon = createIcon(
  <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const HardHatIcon = createIcon(
  <>
    <path d="M2.5 18a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5z" />
    <path d="M10 10.5V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5" />
    <path d="M6 15v-2a6 6 0 0 1 12 0v2" />
  </>,
);

export const ShieldCheckIcon = createIcon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);

export const SlidersIcon = createIcon(
  <>
    <path d="M21 4h-7" />
    <path d="M10 4H3" />
    <path d="M21 12h-9" />
    <path d="M8 12H3" />
    <path d="M21 20h-5" />
    <path d="M12 20H3" />
    <path d="M14 2v4" />
    <path d="M8 10v4" />
    <path d="M16 18v4" />
  </>,
);

export const LogoutIcon = createIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

// ── Actions & status ──────────────────────────────────────────────────────
export const EyeIcon = createIcon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const EyeOffIcon = createIcon(
  <>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <path d="m2 2 20 20" />
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
  </>,
);

export const PencilIcon = createIcon(
  <>
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </>,
);

export const CopyIcon = createIcon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>,
);

export const CheckCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m8.5 12.5 2.5 2.5 5-6" />
  </>,
);

export const CheckIcon = createIcon(
  <>
    <path d="m4 12.5 5 5L20 6.5" />
  </>,
);

export const BanIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </>,
);

export const XIcon = createIcon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const TrashIcon = createIcon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);

export const InboxIcon = createIcon(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
);

export const BoltIcon = createIcon(
  <>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
  </>,
);

export const ClockIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
);

export const HourglassIcon = createIcon(
  <>
    <path d="M5 22h14" />
    <path d="M5 2h14" />
    <path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" />
    <path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
  </>,
);

export const TrendingUpIcon = createIcon(
  <>
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </>,
);

export const TrendingDownIcon = createIcon(
  <>
    <path d="m22 17-8.5-8.5-5 5L2 7" />
    <path d="M16 17h6v-6" />
  </>,
);

export const AlertTriangleIcon = createIcon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>,
);

export const AlertCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </>,
);

export const InfoIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>,
);

// ── UI chrome ──────────────────────────────────────────────────────────────
export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>,
);

export const MoonIcon = createIcon(
  <>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
  </>,
);

export const ChevronsRightIcon = createIcon(
  <>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </>,
);

export const ChevronsLeftIcon = createIcon(
  <>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </>,
);

export const CrownIcon = createIcon(
  <>
    <path d="m2 6 4 4 6-6 6 6 4-4v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
  </>,
);

export const KeyIcon = createIcon(
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.8 12.2 8.7-8.7" />
    <path d="M15.5 7.5l3 3" />
  </>,
);

export const UserIcon = createIcon(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>,
);

export const GemIcon = createIcon(
  <>
    <path d="M6 3h12l4 6-10 12L2 9z" />
    <path d="M2 9h20" />
  </>,
);

export const DownloadIcon = createIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </>,
);

export const ArrowUpIcon = createIcon(
  <>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </>,
);

export const PaperclipIcon = createIcon(
  <>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </>,
);

export const SendIcon = createIcon(
  <>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </>,
);

export const CreditCardIcon = createIcon(
  <>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </>,
);

export const ClipboardIcon = createIcon(
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </>,
);

export const SparklesIcon = createIcon(
  <>
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M5 19h.01" />
    <path d="M19 17h.01" />
  </>,
);

export const LockIcon = createIcon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);

export const CarIcon = createIcon(
  <>
    <path d="M19 17h2l.64-2.87a2 2 0 0 0-.6-1.94L15 6.5A4 4 0 0 0 12.06 5H11a3 3 0 0 0-2.83 2H7.5a4 4 0 0 0-3.6 2.2L2 13v4h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </>,
);

export const BikeIcon = createIcon(
  <>
    <circle cx="5.5" cy="17" r="3.5" />
    <circle cx="18.5" cy="17" r="3.5" />
    <path d="M15 6h4l1.5 4" />
    <path d="M12 15l-3-6 2-3h3" />
    <path d="M7 17l5-2 4 2" />
  </>,
);

export const SaveIcon = createIcon(
  <>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </>,
);

export const PackageIcon = createIcon(
  <>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </>,
);

export const KeyboardIcon = createIcon(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01" />
    <path d="M10 10h.01" />
    <path d="M14 10h.01" />
    <path d="M18 10h.01" />
    <path d="M6 14h.01" />
    <path d="M18 14h.01" />
    <path d="M9 14h6" />
  </>,
);

export const FolderIcon = createIcon(
  <>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
  </>,
);

export const DatabaseIcon = createIcon(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </>,
);

export const GlobeIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>,
);

export const PhoneIcon = createIcon(
  <>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </>,
);

export const BellIcon = createIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
);

export const CalendarIcon = createIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </>,
);

export const PercentIcon = createIcon(
  <>
    <path d="M19 5 5 19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>,
);

export const PrinterIcon = createIcon(
  <>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M6 14h12v7H6z" />
  </>,
);

export const HistoryIcon = createIcon(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const RotateCwIcon = createIcon(
  <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </>,
);
