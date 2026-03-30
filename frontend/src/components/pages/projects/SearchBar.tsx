"use client";

import styles from "./SearchBar.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className={styles.searchWrap}>
      <div className={styles.inputWrap}>
        <input
          id="project-search"
          type="text"
          className={styles.searchInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search projects..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Search projects by name"
        />

        {value.trim().length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange("")}
            aria-label="Clear project search"
            title="Clear search"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}