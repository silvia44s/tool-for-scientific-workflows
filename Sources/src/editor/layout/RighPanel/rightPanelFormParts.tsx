/**
 * @file rightPanelFormParts.tsx
 * @brief Reusable form components used in the right panel sections.
 * @author Silvia Šlachtovská
 * 
 * This file contains basic form elements like labeled inputs, select boxes...
 */

import { useState } from 'react';
import styles from '../RightPanel.module.css';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>;
}

export function AddParamButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.addParamBtn}>
      {children}
    </button>
  );
}

export function BoolSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value === 'false' ? 'false' : 'true'}
        onChange={(e) => onChange(e.target.value)}
        className={styles.select}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        inputMode="numeric"
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') return onChange(undefined);
          const n = Number(t);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        placeholder="—"
      />
    </label>
  );
}

export function TextAreaInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
      />
    </label>
  );
}

export function RoleSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'local' | 'input' | 'output';
  onChange: (v: 'local' | 'input' | 'output') => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'local' | 'input' | 'output')}
        className={styles.select}
      >
        <option value="local">local</option>
        <option value="input">input</option>
        <option value="output">output</option>
      </select>
    </label>
  );
}

export function SimpleStringList({
  items,
  placeholder,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onAdd: (txt: string) => void;
  onUpdate: (index: number, txt: string) => void;
  onRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <div className={styles.simpleList}>
      {items.map((it, i) => (
        <div key={`${it}_${i}`} className={styles.simpleRow}>
          <input
            className={styles.input}
            value={it}
            onChange={(e) => onUpdate(i, e.target.value)}
          />
          <button
            type="button"
            className={styles.simpleRemove}
            onClick={() => onRemove(i)}
            title="Remove"
          >
            <XMarkIcon className={styles.iconAction} />
          </button>
        </div>
      ))}

      <div className={styles.simpleAddRow}>
        <input
          className={styles.input}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className={styles.simpleAdd}
          onClick={() => {
            const v = draft.trim();
            if (!v) return;
            onAdd(v);
            setDraft('');
          }}
          title="Add"
        >
          <PlusIcon className={styles.iconPlus} />
        </button>
      </div>
    </div>
  );
}