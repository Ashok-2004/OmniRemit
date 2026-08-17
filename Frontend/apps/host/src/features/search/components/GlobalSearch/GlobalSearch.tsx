import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../../auth/store/authStore'
import { useClickOutside } from '../../../../shared/hooks/useClickOutside'
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue'
import { Icon } from '../../../../shared/components/Icon/Icon'
import { searchApi, type SearchResultDto } from '../../api/searchApi'
import styles from './GlobalSearch.module.css'

const MIN_QUERY_LENGTH = 2

/** Groups results under headings while preserving the server's ordering within each group. */
function groupResults(results: SearchResultDto[]) {
  const groups = new Map<string, SearchResultDto[]>()
  for (const result of results) {
    const existing = groups.get(result.type)
    if (existing) existing.push(result)
    else groups.set(result.type, [result])
  }
  return [...groups.entries()]
}

/**
 * Topbar command palette.
 *
 * Replaces a `<div aria-hidden="true">` containing the word "Search…" — styled to look exactly like
 * a search field, with no input element, no handler and no focus ring. A sighted user could not tell
 * it apart from a real control, clicked it, and nothing happened.
 *
 * Implements the ARIA combobox pattern: the input owns a listbox, `aria-activedescendant` tracks the
 * highlighted option so focus never leaves the input, and Up/Down/Enter/Escape all behave as
 * expected. Cmd/Ctrl+K focuses it from anywhere.
 */
export function GlobalSearch() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useClickOutside([wrapperRef], () => setOpen(false), open)

  const debouncedQuery = useDebouncedValue(query, 250)
  const isSearchable = debouncedQuery.trim().length >= MIN_QUERY_LENGTH

  const searchQuery = useQuery({
    queryKey: ['search', debouncedQuery.trim()],
    queryFn: () => searchApi.query(accessToken!, debouncedQuery.trim()),
    enabled: Boolean(accessToken) && isSearchable,
    // Results are cheap to re-fetch and go stale as records change; don't serve a minute-old list.
    staleTime: 10_000,
  })

  const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data])
  const grouped = useMemo(() => groupResults(results), [results])

  // Keep the highlight in range as results change underneath it.
  useEffect(() => {
    setHighlighted(0)
  }, [debouncedQuery])

  // Cmd/Ctrl+K from anywhere focuses search — the shortcut users expect from every other admin tool.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function goTo(result: SearchResultDto) {
    setOpen(false)
    setQuery('')
    navigate(result.route)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((i) => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((i) => (i - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const selected = results[highlighted]
      if (selected) goTo(selected)
    }
  }

  const showPanel = open && query.trim().length > 0
  let flatIndex = -1

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.field}>
        <span className={styles.icon} aria-hidden="true">
          <Icon.Search width={16} height={16} />
        </span>
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder="Search users, roles…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && results[highlighted] ? `search-option-${results[highlighted].id}` : undefined
          }
        />
        <kbd className={styles.shortcut} aria-hidden="true">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div className={styles.panel}>
          {!isSearchable ? (
            <p className={styles.hint}>Keep typing to search…</p>
          ) : searchQuery.isPending ? (
            <p className={styles.hint}>Searching…</p>
          ) : searchQuery.isError ? (
            <p className={styles.error}>Could not run the search.</p>
          ) : results.length === 0 ? (
            <p className={styles.hint}>No matches for “{debouncedQuery.trim()}”.</p>
          ) : (
            <ul className={styles.listbox} id="global-search-listbox" role="listbox">
              {grouped.map(([type, items]) => (
                <li key={type} role="presentation">
                  <div className={styles.groupLabel} role="presentation">
                    {type}s
                  </div>
                  <ul className={styles.group} role="group" aria-label={`${type}s`}>
                    {items.map((item) => {
                      flatIndex += 1
                      const isActive = flatIndex === highlighted
                      const myIndex = flatIndex
                      return (
                        <li
                          key={item.id}
                          id={`search-option-${item.id}`}
                          role="option"
                          aria-selected={isActive}
                          className={isActive ? styles.optionActive : styles.option}
                          onMouseEnter={() => setHighlighted(myIndex)}
                          // onMouseDown, not onClick: click fires after blur, which would have
                          // already closed the panel and cancelled the navigation.
                          onMouseDown={(e) => {
                            e.preventDefault()
                            goTo(item)
                          }}
                        >
                          <span className={styles.optionTitle}>{item.title}</span>
                          {item.subtitle && <span className={styles.optionSubtitle}>{item.subtitle}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
