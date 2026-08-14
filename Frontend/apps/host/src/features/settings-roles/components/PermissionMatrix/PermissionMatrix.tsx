import { Checkbox } from '../../../../shared/components/Checkbox/Checkbox'
import type { PermissionFeatureDto } from '../../../../shared/api/permissionsApi'
import type { RolePermissionGrantDto } from '../../api/rolesApi'
import styles from './PermissionMatrix.module.css'

export interface PermissionMatrixProps {
  catalog: PermissionFeatureDto[]
  capabilities: string[]
  permissions: RolePermissionGrantDto[]
  onChange: (permissions: RolePermissionGrantDto[]) => void
  disabled?: boolean
}

/** Defines what a role grants outright — every checked cell becomes a RolePermission row. Grouped by catalog source, each group has a "Select all" toggle. */
export function PermissionMatrix({ catalog, capabilities, permissions, onChange, disabled }: PermissionMatrixProps) {
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
    const groupKeys = features.flatMap((f) => capabilities.map((c) => ({ featureKey: f.key, capability: c })))
    const allSelected = groupKeys.every((g) => has(g.featureKey, g.capability))

    if (allSelected) {
      onChange(permissions.filter((p) => !features.some((f) => f.key === p.featureKey)))
    } else {
      const additions = groupKeys.filter((g) => !has(g.featureKey, g.capability))
      onChange([...permissions, ...additions])
    }
  }

  if (catalog.length === 0) {
    return <div className={styles.wrapper}><div className={styles.emptyState}>No permission features registered yet.</div></div>
  }

  return (
    <div className={styles.wrapper}>
      {Object.entries(grouped).map(([source, features]) => (
        <div key={source}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>{source === 'Host' ? 'Platform' : 'Remote apps'}</span>
            {!disabled && (
              <button type="button" className={styles.selectAll} onClick={() => toggleGroup(features)}>
                Select all
              </button>
            )}
          </div>
          {features.map((feature) => (
            <div className={styles.row} key={feature.key}>
              <span className={styles.featureName}>{feature.displayName}</span>
              <div className={styles.capabilities}>
                {capabilities.map((capability) => (
                  <Checkbox
                    key={capability}
                    label={capability}
                    checked={has(feature.key, capability)}
                    disabled={disabled}
                    onChange={() => toggle(feature.key, capability)}
                  />
                ))}
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
