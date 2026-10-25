import React, { useEffect, useMemo, useState } from "react";
import { ariaDescribedByIds, type WidgetProps } from "@rjsf/utils";
import { useGetDocumentsQuery } from "@/store";
import type { TerminusDBDocument } from "@/types/terminusdb";

// Ported from zebra's studio TextAreaWidget, minus the milkdown/markdown
// editor and fullscreen modal — a monospace autosizing textarea.
export function TdbTextareaWidget({
  id,
  placeholder,
  value,
  required,
  disabled,
  readonly,
  onBlur,
  onFocus,
  onChange,
  options,
}: Readonly<WidgetProps>) {
  const [singleRow, setSingleRow] = useState(typeof value !== "string" || !/[\r\n]/.test(value));

  const handleChange = (next: string) => {
    onChange(next === "" ? options.emptyValue : next);
    setSingleRow(!/[\r\n]/.test(next));
  };

  const rows = Number(options.rows ?? 3);

  return (
    <textarea
      id={id}
      className="form-control textarea-monospace"
      name={id}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      value={value ?? ""}
      required={required}
      rows={singleRow ? 1 : rows}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => onBlur?.(id, e.target.value)}
      onFocus={(e) => onFocus?.(id, e.target.value)}
      aria-describedby={ariaDescribedByIds(id)}
    />
  );
}

// TerminusDB document links surface in the JSON Schema as
// { "type": "string", "x-terminusdb": { "link": "<Class>" } } — the analogue
// of zebra's `linkedType`, for which the studio swaps in a searchable record
// selector. Same idea here: a filterable input listing existing ids of the
// linked type, while still allowing free-text ids (links may point at
// documents created later or on other branches).
export function makeLinkWidget(docPath: string, linkType: string) {
  const LinkedDocumentWidget: React.FC<WidgetProps> = ({
    id,
    value,
    required,
    disabled,
    readonly,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    options,
  }) => {
    const [inputValue, setInputValue] = useState<string>(typeof value === "string" ? value : "");

    useEffect(() => {
      setInputValue(typeof value === "string" ? value : "");
    }, [value]);

    const { data: docs, isFetching } = useGetDocumentsQuery(
      { path: docPath, type: linkType, asList: true, count: 200 },
      { skip: !docPath }
    );

    const ids = useMemo(() => {
      let list: TerminusDBDocument[];
      if (Array.isArray(docs)) {
        list = docs;
      } else if (docs) {
        list = [docs];
      } else {
        list = [];
      }
      return list.map((d) => d["@id"]).sort((a, b) => a.localeCompare(b));
    }, [docs]);

    const listId = `${id}-candidates`;

    return (
      <div className="tdb-link-widget">
        <input
          id={id}
          className="form-control"
          list={listId}
          value={inputValue}
          required={required}
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder ?? `${linkType}/…`}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value === "" ? options.emptyValue : e.target.value);
          }}
          onBlur={(e) => onBlur?.(id, e.target.value)}
          onFocus={(e) => onFocus?.(id, e.target.value)}
          aria-describedby={ariaDescribedByIds(id)}
        />
        <datalist id={listId}>
          {ids.map((docId) => (
            <option key={docId} value={docId} />
          ))}
        </datalist>
        {isFetching && <span className="tdb-link-loading">…</span>}
      </div>
    );
  };
  LinkedDocumentWidget.displayName = `LinkedDocumentWidget(${linkType})`;
  return LinkedDocumentWidget;
}
