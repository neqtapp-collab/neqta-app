'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  secondary?: string;
  badge?: string;
};

export type SelectAction = {
  label: string;
  onSelect: () => void;
};

export function CustomSelect({ value, options, placeholder = 'Selecione...', ariaLabel, onChange, actions = [] }: {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  actions?: SelectAction[];
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, options, value]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function keyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      setActiveIndex((current) => event.key === 'ArrowDown' ? (current + 1) % options.length : (current - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex); else setOpen(true);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return <div className={`neqta-select${open ? ' open' : ''}`} ref={root}>
    <button ref={button} type="button" className="neqta-select-trigger" role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)} onKeyDown={keyDown}>
      <span className={selected ? '' : 'placeholder'}>{selected?.label ?? placeholder}</span>
      {selected?.badge && <em>{selected.badge}</em>}
      <ChevronDown />
    </button>
    {open && <div id={listId} className="neqta-select-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option, index) => <button type="button" role="option" aria-selected={option.value === value} className={index === activeIndex ? 'active' : ''} key={option.value} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>
        <span><b>{option.label}</b>{option.secondary && <small>{option.secondary}</small>}</span>
        {option.badge && <em>{option.badge}</em>}
        {option.value === value && <Check />}
      </button>)}
      {actions.length > 0 && <div className="neqta-select-actions">{actions.map((action) => <button type="button" key={action.label} onClick={() => { setOpen(false); action.onSelect(); }}>{action.label}</button>)}</div>}
    </div>}
  </div>;
}
