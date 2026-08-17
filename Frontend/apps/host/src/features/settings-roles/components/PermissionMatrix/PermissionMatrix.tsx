import { Checkbox } from '../../../../shared/components/Checkbox/Checkbox'
import type { PermissionFeatureDto } from '../../../../shared/api/permissionsApi'
import type { RolePermissionGrantDto } from '../../api/rolesApi'
import styles from './PermissionMatrix.module.css'

export interface PermissionMatrixProps {
  catalog: PermissionFeatureDto[]
  permissions: RolePermissionGrantDto[]
  onChange: (permissions: RolePermissionGrantDto[]) => void
  disabled?: boolean
  /** Shown when catalog is empty. Defaults to the generic "not registered yet" message; callers that pre-filter to one source (e.g. a Host-only or RemoteApp-only tab) should pass something specific to that context. */
  emptyMessage?: string
  /** Set false when the caller already pre-filtered catalog to a single source (e.g. one tab per source) — the per-group "Platform"/"Remote apps" label would just be a redundant repeat of the tab's own title. */
  showGroupHeader?: boolean
}

/**
 * Defines what a role grants outright — every checked cell becomes a RolePermission row. Grouped
 * by catalog source, each group has a "Select all" toggle. Each feature renders ONLY its own
 * declared capabilities (feature.capabilities) — not a shared global column list — so a feature
 * that only declares Create+Edit shows exactly those two checkboxes, and a newly-added capability
 * on any feature (host or remote) shows up here the next time the catalog is fetched, with nothing
 * to hand-edit on this side.
 */
export function PermissionMatrix({
  catalog,
  permissions,
  onChange,
  disabled,
  emptyMessage = 'No permission features registered yet.',
  showGroupHeader = true,
}: PermissionMatrixProps) {
  const grouped = groupBy(catalog, (f) => f.source)
  const has = (featureKey: string, capability: string) =>
    permissions.some((p) => p.featureKey === featureKey && p.capability === capability)

  function toggle(featureKey: string, capability: string) {
    if (has(featureKey, capability)) {
      onChange(permissions.filter((p) => !(p.featureKey === featureKey && p.capability === capability)))
    } else {
      onChange([...permissions, { featureKey, capability }])
    }
  }

  function toggleGroup(features: PermissionFeatureDto[]) {
    const groupKeys = features.flatMap((f) => f.capabilities.map((c) => ({ featureKey: f.key, capability: c.key })))
    const allSelected = groupKeys.length > 0 && groupKeys.every((g) => has(g.featureKey, g.capability))

    if (allSelected) {
      onChange(permissions.filter((p) => !features.some((f) => f.key === p.featureKey)))
    } else {
      const additions = groupKeys.filter((g) => !has(g.featureKey, g.capability))
      onChange([...permissions, ...additions])
    }
  }

  if (catalog.length === 0) {
    return <div className={styles.wrapper}><div className={styles.emptyState}>{emptyMessage}</div></div>
  }

  return (
    <div className={styles.wrapper}>
      {Object.entries(grouped).map(([source, features]) => (
        <div key={source}>
          {showGroupHeader && (
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>{source === 'Host' ? 'Platform' : 'Remote apps'}</span>
              {!disabled && (
                <button type="button" className={styles.selectAll} onClick={() => toggleGroup(features)}>
                  Select all
                </button>
              )}
            </div>
          )}
          {!showGroupHeader && !disabled && (
            <div className={styles.groupHeader}>
              <span />
              <button type="button" className={styles.selectAll} onClick={() => toggleGroup(features)}>
                Select all
              </button>
            </div>
          )}
          {features.map((feature) => (
            <div className={styles.row} key={feature.key}>
              <span className={styles.featureName}>{feature.displayName}</span>
              <div className={styles.capabilities}>
                {feature.capabilities.length === 0 ? (
                  <span className={styles.noCapabilities}>No actions declared yet</span>
                ) : (
                  feature.capabilities.map((capability) => (
                    <Checkbox
                      key={capability.key}
                      label={capability.displayName}
                      checked={has(feature.key, capability.key)}
                      disabled={disabled}
                      onChange={() => toggle(feature.key, capability.key)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function groupBy<T, K extends PropertyKey>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyFn(item)
    ;(result[key] ??= []).push(item)
  }
  return result
}
