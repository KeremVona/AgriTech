/** Small line icons for the diagnostics page (24px grid, currentColor stroke). */
import type { ReactNode } from 'react';

function Icon({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const LeafIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </Icon>
);

export const CameraIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.66-.89l.82-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.66.89l.82 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="3" />
  </Icon>
);

export const UploadIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M16 8l-4-4-4 4M12 4v12" />
  </Icon>
);

export const ScanIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />
  </Icon>
);

export const ClipboardCheckIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 13l2 2 4-4" />
  </Icon>
);

export const SunIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const SpotIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="14.5" cy="13.5" r="2" />
  </Icon>
);

export const DistanceIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </Icon>
);

export const CheckCircleIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Icon>
);

export const AlertIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Icon>
);

export const AlertCircleIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
);

export const OctagonIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M7.9 2.5h8.2l5.4 5.4v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9Z" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M5 12h13m-5-5 5 5-5 5" />
  </Icon>
);

export const CopyIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);

export const RetryIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 4v5h5M20 20v-5h-5" />
    <path d="M5.5 15a7.5 7.5 0 0 0 13.4 1.5M18.5 9A7.5 7.5 0 0 0 5.1 7.5" />
  </Icon>
);
