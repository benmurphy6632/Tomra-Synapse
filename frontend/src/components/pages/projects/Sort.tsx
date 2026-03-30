"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./Sort.module.css";

export type SortOption =
  | "last-opened"
  | "most-active"
  | "title-az"
  | "created-newest"
  | "created-oldest";

type Props = {
  value: SortOption;
  onChange: (value: SortOption) => void;
};

const OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "last-opened", label: "Recently Opened" },
  { value: "most-active", label: "Most Active" },
  { value: "title-az", label: "Name (A–Z)" },
  { value: "created-newest", label: "Newest" },
  { value: "created-oldest", label: "Oldest" },
];

export default function Sort({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.value === value) ?? OPTIONS[0],
    [value]
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = OPTIONS.findIndex((option) => option.value === value);
    const target = optionRefs.current[selectedIndex] ?? optionRefs.current[0];
    target?.focus();
  }, [open, value]);

  function handleToggle() {
    setOpen((prev) => !prev);
  }

  function handleSelect(nextValue: SortOption) {
    onChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % OPTIONS.length;
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      optionRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      optionRefs.current[OPTIONS.length - 1]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div className={styles.sortWrap} ref={rootRef}>
      <span className={styles.sortLabel}>Sort by</span>

      <div className={styles.dropdown}>
        <button
          ref={buttonRef}
          type="button"
          className={styles.sortButton}
          onClick={handleToggle}
          onKeyDown={handleButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Sort projects by ${selectedOption.label}`}
        >
          <span className={styles.sortButtonText}>{selectedOption.label}</span>
          <span
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {open && (
          <div className={styles.menu} role="listbox" aria-label="Sort projects">
            {OPTIONS.map((option, index) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.option} ${
                    selected ? styles.optionSelected : ""
                  }`}
                  onClick={() => handleSelect(option.value)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                >
                  <span>{option.label}</span>
                  {selected && (
                    <span className={styles.checkmark} aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}