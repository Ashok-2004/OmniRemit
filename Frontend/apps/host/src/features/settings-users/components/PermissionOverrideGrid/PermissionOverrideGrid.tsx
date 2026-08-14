import { Checkbox } from '../../../../shared/components/Checkbox/Checkbox'
import type { PermissionFeatureDto } from '../../../../shared/api/permissionsApi'
import type { PermissionOverrideDto } from '../../api/usersApi'
import styles from './PermissionOverrideGrid.module.css'

export interface PermissionOverrideGridProps {
  catalog: PermissionFeatureDto[]
  capabilities: string[]
  /** "featureKey:Capability" strings the currently-selected role grants — the baseline overrides are layered on top of. */
  roleGrants: Set<string>
  overrides: PermissionOverrideDto[]
  onChange: (overrides: PermissionOverrideDto[]) => void
  disabled?: boolean
}

/**
 * Tri-state per cell: role-default (no override row), Grant (adds a capability the role doesn't
 * have), Revoke (removes one it does) — see AuthService's PermissionClaimsBuilder for the same
 * logic applied server-side at login.
 */
export function PermissionOverrideGrid({
  catalog,
  capabilities,
  roleGrants,
  overrides,
  onChange,
  disabled,
}: PermissionOverrideGridProps) {
  const grouped = groupBy(catalog, (f) => f.source)

  function toggle(featureKey: string, capability: string, roleGrantsIt: boolean) {
    const existingIndex = overrides.findIndex((o) => o.featureKey === featureKey && o.capability === capability)

    if (existingIndex >= 0) {
      onChange(overrides.filter((_, i) => i !== existingIndex))
      return
    }

    onChange([...overrides, { featureKey, capability, effect: roleGrantsIt ? 'Revoke' : 'Grant' }])
  }

  return (
    <div className={styles.wrapper}>
      {Object.entries(grouped).map(([source, features]) => (
        <div key={source}>
          <div className={styles.groupHeader}>{source === 'Host' ? 'Platform' : 'Remote apps'}</div>
          {features.map((feature) => (
            <div className={styles.row} key={feature.key}>
              <span className={styles.featureName}>{feature.displayName}</span>
              <div className={styles.capabilities}>
                {capabilities.map((capability) => {
                  const key = `${feature.key}:${capability}`
                  const roleGrantsIt = roleGrants.has(key)
                  const override = overrides.find((o) => o.featureKey === feature.key && o.capability === capability)
                  const checked = override ? override.effect === 'Grant' : roleGrantsIt

                  return (
                    <span
                      className={styles.cell}
                      key={capability}
                      title={override ? `Overrides the role's default (${roleGrantsIt ? 'granted' : 'not granted'})` : undefined}
                    >
                      <Checkbox
                        label={capability}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(feature.key, capability, roleGrantsIt)}
                      />
                      {override && <span className={styles.overrideDot} aria-hidden="true" />}
                    </span>
                  )
                })}
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
