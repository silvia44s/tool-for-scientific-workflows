/**
 * @file formFields.tsx
 * @brief Reusable form field components used in the right panel sections.
 * @author Silvia Šlachtovská
 *
 * This file contains simple reusable UI building blocks such as labeled inputs,
 * select boxes, checkboxes, action buttons, and editable string lists.
 */

import { useState } from 'react';
import styles from './RightPanel.module.css';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

type ChildrenProps = {
  children: React.ReactNode;
};

type ButtonWithChildrenProps = {
  children: React.ReactNode;
  onClick: () => void;
};

type StringFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

type NumberFieldProps = {
  label: string;
  value: number | '';
  onChange: (value: number | undefined) => void;
};

type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type RoleValue = 'local' | 'input' | 'output';

type RoleFieldProps = {
  label: string;
  value: RoleValue;
  onChange: (value: RoleValue) => void;
};

type RoleCheckboxesProps = {
  value: RoleValue;
  onChange: (value: RoleValue) => void;
};

type SimpleStringListProps = {
  items: string[];
  placeholder: string;
  onAdd: (text: string) => void;
  onUpdate: (index: number, text: string) => void;
  onRemove: (index: number) => void;
};

/**
 * @brief Displays a standard section title in the right panel.
 *
 * @param children Title content.
 * @return Styled section title element.
 */
export function SectionTitle({ children }: ChildrenProps) {
  return <div className={styles.sectionTitle}>{children}</div>;
}

/**
 * @brief Button used for adding a new parameter or similar item.
 *
 * @param children Button content.
 * @param onClick Click handler.
 * @return Styled add button.
 */
export function AddParamButton({
  children,
  onClick,
}: ButtonWithChildrenProps) {
  return (
    <button type="button" onClick={onClick} className={styles.addParamBtn}>
      {children}
    </button>
  );
}

/**
 * @brief Select field for boolean values.
 *
 * @param label Field label.
 * @param value Current boolean value stored as string.
 * @param onChange Change handler.
 * @return Boolean select input.
 */
export function BoolSelect({
  label,
  value,
  onChange,
}: StringFieldProps) {
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

/**
 * @brief Standard labeled text input.
 *
 * @param label Field label.
 * @param value Current input value.
 * @param onChange Change handler.
 * @return Labeled text input.
 */
export function LabeledInput({
  label,
  value,
  onChange,
}: StringFieldProps) {
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

/**
 * @brief Numeric input field with support for empty value.
 *
 * @param label Field label.
 * @param value Current numeric value.
 * @param onChange Change handler.
 * @return Labeled numeric input.
 */
export function NumberInput({
  label,
  value,
  onChange,
}: NumberFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        inputMode="numeric"
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          const text = e.target.value.trim();
          if (text === '') return onChange(undefined);

          const numberValue = Number(text);
          if (!Number.isFinite(numberValue)) return;

          onChange(numberValue);
        }}
        placeholder="—"
      />
    </label>
  );
}

/**
 * @brief Multiline text input field.
 *
 * @param label Field label.
 * @param value Current text value.
 * @param onChange Change handler.
 * @param placeholder Optional placeholder text.
 * @return Labeled textarea input.
 */
export function TextAreaInput({
  label,
  value,
  onChange,
  placeholder,
}: TextAreaFieldProps) {
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

/**
 * @brief Select field for choosing parameter exposure role.
 *
 * @param label Field label.
 * @param value Current role value.
 * @param onChange Change handler.
 * @return Labeled role select box.
 */
export function RoleSelect({
  label,
  value,
  onChange,
}: RoleFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RoleValue)}
        className={styles.select}
      >
        <option value="local">local</option>
        <option value="input">input</option>
        <option value="output">output</option>
      </select>
    </label>
  );
}

/**
 * @brief Checkbox-based control for setting whether a parameter is exposed as input or output.
 *
 * @param value Current role value.
 * @param onChange Change handler.
 * @return Group of role checkboxes.
 */
export function RoleCheckboxes({
  value,
  onChange,
}: RoleCheckboxesProps) {
  return (
    <label className={styles.field}>
      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={value === 'input'}
            onChange={(e) => onChange(e.target.checked ? 'input' : 'local')}
          />
          <span>Expose as input port</span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={value === 'output'}
            onChange={(e) => onChange(e.target.checked ? 'output' : 'local')}
          />
          <span>Expose as output port</span>
        </label>
      </div>
    </label>
  );
}

/**
 * @brief Editable list of string items with add and remove actions.
 *
 * @param items Current list items.
 * @param placeholder Placeholder for the add input.
 * @param onAdd Handler for adding a new item.
 * @param onUpdate Handler for updating an existing item.
 * @param onRemove Handler for removing an item.
 * @return Editable string list component.
 */
export function SimpleStringList({
  items,
  placeholder,
  onAdd,
  onUpdate,
  onRemove,
}: SimpleStringListProps) {
  const [draft, setDraft] = useState('');

  return (
    <div className={styles.simpleList}>
      {items.map((item, index) => (
        <div key={`${item}_${index}`} className={styles.simpleRow}>
          <input
            className={styles.input}
            value={item}
            onChange={(e) => onUpdate(index, e.target.value)}
          />
          <button
            type="button"
            className={styles.simpleRemove}
            onClick={() => onRemove(index)}
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
            const value = draft.trim();
            if (!value) return;
            onAdd(value);
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