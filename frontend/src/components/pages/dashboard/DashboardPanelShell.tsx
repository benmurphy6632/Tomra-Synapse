"use client";

import React from "react";
import { useRouter } from "next/navigation";
import styles from "./Dashboard.module.css";

type Props = {
  href?: string; // if provided → clickable
  ariaLabel?: string;
  heightClass: string; // e.g. "h-[70vh]"
  children: React.ReactNode;
  disableHover?: boolean; // ✅ add this
};

export default function DashboardPanelShell({
  href,
  ariaLabel,
  heightClass,
  children,
  disableHover = false,
}: Props) {
  const router = useRouter();

  // Base panel class
  const basePanelClass = `${styles.panel} ${heightClass} ${
    disableHover ? styles.noHover : ""
  }`;

  // Clickable panel
  if (href) {
    return (
      <div
        className={`${basePanelClass} cursor-pointer`}
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => router.push(href)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(href);
          }
        }}
      >
        {/* ✅ If hover disabled, also remove arrow hover animation by not rendering it */}
        {!disableHover && (
          <span className={styles.cornerArrow} aria-hidden="true">
            →
          </span>
        )}

        {children}
      </div>
    );
  }

  // Non-clickable panel
  return <div className={basePanelClass}>{children}</div>;
}
