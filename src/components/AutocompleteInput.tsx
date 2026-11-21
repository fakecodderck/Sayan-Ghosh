import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';

export interface AutocompleteInputProps<T> {
  value: string;
  onChange: (value: string) => void;
  items: T[];
  filterItem: (item: T, normalizedQuery: string) => boolean;
  rankItem?: (item: T, normalizedQuery: string) => number;
  getItemKey: (item: T) => string;
  renderItem: (item: T, isHighlighted: boolean) => React.ReactNode;
  onSelect: (item: T) => void;
  onClear?: () => void;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
  isSelected?: boolean;
  selectedTitle?: string;
  showSearchIcon?: boolean;
  minDropdownWidth?: number;
  maxResults?: number;
  emptyState?: React.ReactNode;
  ariaLabel?: string;
}

interface PopoverCoords {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

export function AutocompleteInput<T>({
  value,
  onChange,
  items,
  filterItem,
  rankItem,
  getItemKey,
  renderItem,
  onSelect,
  onClear,
  placeholder,
  inputClassName = '',
  disabled = false,
  isSelected = false,
  selectedTitle,
  showSearchIcon = false,
  minDropdownWidth,
  maxResults = 12,
  emptyState,
  ariaLabel,
}: AutocompleteInputProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const normalizedQuery = value.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return [];
    const matches = items.filter(item => filterItem(item, normalizedQuery));
    if (rankItem) {
      matches.sort((a, b) => rankItem(a, normalizedQuery) - rankItem(b, normalizedQuery));
    }
    return matches.slice(0, maxResults);
  }, [items, normalizedQuery, filterItem, rankItem, maxResults]);

  const shouldShowDropdown =
    isOpen &&
    !disabled &&
    normalizedQuery.length > 0 &&
    (filteredItems.length > 0 || Boolean(emptyState));

  const updatePosition = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const desiredWidth = Math.min(
      Math.max(rect.width, minDropdownWidth || rect.width),
      viewportW - 24
    );
    const clampedLeft = Math.max(12, Math.min(rect.left, viewportW - desiredWidth - 12));
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    setCoords({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: clampedLeft,
      width: desiredWidth,
      openUpward,
    });
  };

  useEffect(() => {
    if (!shouldShowDropdown) return;
    updatePosition();

    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [shouldShowDropdown, value, filteredItems.length]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [normalizedQuery, filteredItems.length]);

  useEffect(() => {
    if (!shouldShowDropdown || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-suggestion-index="${highlightedIndex}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, shouldShowDropdown]);

  const handleSelectItem = (item: T) => {
    onSelect(item);
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen && normalizedQuery.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }
      if (shouldShowDropdown && filteredItems.length > 0) {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % filteredItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      if (shouldShowDropdown && filteredItems.length > 0) {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      }
    } else if (e.key === 'Enter') {
      if (shouldShowDropdown && filteredItems.length > 0 && filteredItems[highlightedIndex]) {
        e.preventDefault();
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      if (shouldShowDropdown) {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        setIsOpen(false);
      }
    }
  };

  const showRightIcons = value.length > 0 && !disabled;

  return (
    <div className="relative w-full">
      {showSearchIcon && (
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shouldShowDropdown}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (!isSelected && value.trim().length > 0) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          setIsOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 theme-ring transition-colors ${
          showSearchIcon ? 'pl-8' : 'pl-2.5'
        } ${showRightIcons ? (isSelected ? 'pr-12' : 'pr-7') : 'pr-2.5'} ${inputClassName}`}
      />

      {showRightIcons && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {isSelected && (
            <span
              title={selectedTitle || 'Linked record'}
              className="text-emerald-600 dark:text-emerald-400 p-0.5 pointer-events-none"
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear input"
            onMouseDown={e => {
              e.preventDefault();
              if (onClear) {
                onClear();
              } else {
                onChange('');
              }
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {shouldShowDropdown &&
        coords &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              ...(coords.openUpward
                ? { bottom: `${window.innerHeight - coords.top}px` }
                : { top: `${coords.top}px` }),
            }}
            className="z-[70] max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs"
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={getItemKey(item)}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    data-suggestion-index={idx}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectItem(item);
                    }}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      isHighlighted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {renderItem(item, isHighlighted)}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2">{emptyState}</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
