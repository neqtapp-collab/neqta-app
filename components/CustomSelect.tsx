'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

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

export function CustomSelect({ value, options, placeholder = 'Selecione...', ariaLabel, onChange, actions = [], searchable: searchableOption = false, searchPlaceholder = 'Buscar...', emptyMessage = 'Nenhuma opção encontrada.' }: {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  actions?: SelectAction[];
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const searchable = searchableOption || /ingrediente|preparo|embalagem|fornecedor|produto/i.test(ariaLabel);
  const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  const visibleOptions = useMemo(() => !normalizedQuery ? options : options.filter((option) => `${option.label} ${option.secondary ?? ''} ${option.badge ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedQuery)), [normalizedQuery, options]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    if (searchable) window.setTimeout(() => searchInput.current?.focus(), 0);
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, searchable, value]);

  useEffect(() => { setActiveIndex(0); }, [normalizedQuery]);

  function choose(index: number) {
    const option = visibleOptions[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function keyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (!visibleOptions.length) return;
      setActiveIndex((current) => event.key === 'ArrowDown' ? (current + 1) % visibleOptions.length : (current - 1 + visibleOptions.length) % visibleOptions.length);
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
      {searchable && <label className="neqta-select-search"><Search /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!visibleOptions.length) return; setActiveIndex((current) => event.key === 'ArrowDown' ? (current + 1) % visibleOptions.length : (current - 1 + visibleOptions.length) % visibleOptions.length); } else if (event.key === 'Enter' && visibleOptions.length) { event.preventDefault(); choose(activeIndex); } else if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }} placeholder={searchPlaceholder} aria-label={`Buscar em ${ariaLabel}`} /></label>}
      {visibleOptions.map((option, index) => <button type="button" role="option" aria-selected={option.value === value} className={index === activeIndex ? 'active' : ''} key={option.value} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>
        <span><b>{option.label}</b>{option.secondary && <small>{option.secondary}</small>}</span>
        {option.badge && <em>{option.badge}</em>}
        {option.value === value && <Check />}
      </button>)}
      {!visibleOptions.length && <p className="neqta-select-empty">{emptyMessage}</p>}
      {actions.length > 0 && <div className="neqta-select-actions">{actions.map((action) => <button type="button" key={action.label} onClick={() => { setOpen(false); action.onSelect(); }}>{action.label}</button>)}</div>}
    </div>}
  </div>;
}
