import { useMemo, useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";

interface Props {
  readonly options: readonly string[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly "aria-label"?: string;
  /** Display label for an option value (values stay unchanged). */
  readonly formatOption?: (value: string) => string;
}

const inputCls =
  "w-full truncate rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

// Single-select combobox with type-ahead filtering — used for link targets,
// primitive types and other long option lists.
export function FilterCombobox({ options, value, onChange, placeholder, emptyLabel, disabled, className, formatOption, ...rest }: Props) {
  const [query, setQuery] = useState("");
  const fmt = useMemo(() => formatOption ?? ((o: string) => o), [formatOption]);
  const filtered = useMemo(
    () => (query ? options.filter((o) => `${o} ${fmt(o)}`.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query, fmt]
  );

  return (
    <Combobox value={value} onChange={(v: string | null) => onChange(v ?? "")} disabled={disabled} immediate>
      <div className={`relative ${className ?? ""}`}>
        <ComboboxInput
          className={inputCls}
          displayValue={(v: string) => fmt(v)}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={rest["aria-label"]}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 px-1 text-gray-400" aria-hidden="true">
          ▾
        </ComboboxButton>
        <ComboboxOptions
          anchor="bottom start"
          portal
          className="absolute z-50 mt-1 max-h-56 w-[var(--input-width)] overflow-auto rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {filtered.length === 0 && <div className="px-2 py-1 text-gray-400">{emptyLabel ?? "No matches"}</div>}
          {filtered.map((o) => (
            <ComboboxOption
              key={o}
              value={o}
              className="block w-full cursor-pointer truncate px-2 py-1.5 data-[focus]:bg-sky-100 dark:data-[focus]:bg-sky-900/60 data-[selected]:font-medium"
            >
              {fmt(o)}
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}

interface MultiProps {
  readonly options: readonly string[];
  readonly values: readonly string[];
  readonly onChange: (values: string[]) => void;
  readonly placeholder?: string;
  readonly "aria-label"?: string;
  readonly className?: string;
}

// Multi-select combobox with chips + type-ahead — used for @inherits parents.
export function FilterMultiCombobox({ options, values, onChange, placeholder, className, ...rest }: MultiProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      options
        .filter((o) => !values.includes(o))
        .filter((o) => !query || o.toLowerCase().includes(query.toLowerCase())),
    [options, values, query]
  );

  return (
    <Combobox multiple value={[...values]} onChange={(v: string[]) => onChange(v)} immediate>
      <div className={`relative ${className ?? ""}`}>
        <div className="flex flex-wrap items-center gap-1 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900">
          {values.map((v) => (
            <span key={v} className="inline-flex max-w-full items-center gap-0.5 truncate rounded bg-sky-100 px-1 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-200">
              {v}
              <button
                type="button"
                className="text-sky-500 hover:text-sky-800"
                aria-label={`remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                ×
              </button>
            </span>
          ))}
          <ComboboxInput
            className="min-w-16 flex-1 bg-transparent px-1 py-0.5 text-xs outline-none dark:text-gray-100"
            placeholder={values.length === 0 ? placeholder : undefined}
            onChange={(e) => setQuery(e.target.value)}
            displayValue={() => ""}
            aria-label={rest["aria-label"]}
          />
        </div>
        <ComboboxOptions
          anchor="bottom start"
          portal
          className="absolute z-50 mt-1 max-h-56 w-[var(--input-width)] overflow-auto rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {filtered.length === 0 && <div className="px-2 py-1 text-gray-400">No matches</div>}
          {filtered.map((o) => (
            <ComboboxOption key={o} value={o} className="block w-full cursor-pointer truncate px-2 py-1.5 data-[focus]:bg-sky-100 dark:data-[focus]:bg-sky-900/60">
              {o}
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
