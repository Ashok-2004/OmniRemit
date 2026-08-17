import { useState } from 'react'
import { Checkbox } from '../../../../shared/components/Checkbox/Checkbox'
import { Badge } from '../../../../shared/components/Badge/Badge'
import { Icon } from '../../../../shared/components/Icon/Icon'
import type { PermissionFeatureDto } from '../../../../shared/api/permissionsApi'
import type { RolePermissionGrantDto } from '../../api/rolesApi'
import styles from './PermissionMatrix.module.css'

export interface PermissionMatrixProps {
  catalog: PermissionFeatureDto[]
  permissions: RolePermissionGrantDto[]
  onChange: (permissions: RolePermissionGrantDto[]) => void
  disabled?: boolean
  emptyMessage?: string
  /**
   * 'modules' renders each feature as a collapsible card whose ROWS are its sub-modules and whose
   * COLUMNS are actions — the Application Access view. 'flat' renders one labelled row per feature,
   * used for Host Permissions, which has no sub-modules.
   */
  variant?: 'modules' | 'flat'
}

/**
 * Defines what a role grants outright — every checked cell becomes a RolePermission row.
 *
 * Columns are derived from the union of capabilities the features in a card ACTUALLY declare, never
 * a hardcoded Create/View/Edit/Delete four. An app that exposes Export or Approve gets those columns
 * automatically the next time the catalog is fetched, and a cell is only rendered where that
 * specific sub-module really declares that action — so the grid never offers a permission the
 * backend would not enforce.
 */
export function PermissionMatrix({
  catalog,
  permissions,
  onChange,
  disabled,
  emptyMessage = 'No permission features registered yet.',
  variant = 'modules',
}: PermissionMatrixProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const has = (featureKey: string, capability: string) =>
    permissions.some((p) => p.featureKey === featureKey && p.capability === capability)

  function toggle(featureKey: string, capability: string) {
    if (has(featureKey, capability)) {
      onChange(permissions.filter((p) => !(p.featureKey === featureKey && p.capability === capability)))
    } else {
      onChange([...permissions, { featureKey, capability }])
    }
  }

  /** Every (feature, capability) pair inside a feature and its sub-modules. */
  function allGrantsFor(feature: PermissionFeatureDto): RolePermissionGrantDto[] {
    const own = feature.capabilities.map((c) => ({ featureKey: feature.key, capability: c.key }))
    const fromChildren = feature.children.flatMap((child) =>
      child.capabilities.map((c) => ({ featureKey: child.key, capability: c.key })),
    )
    return [...own, ...fromChildren]
  }

  function setAll(feature: PermissionFeatureDto, granted: boolean) {
    const target = allGrantsFor(feature)
    const targetKeys = new Set(target.map((g) => `${g.featureKey}:${g.capability}`))
    const without = permissions.filter((p) => !targetKeys.has(`${p.featureKey}:${p.capability}`))
    onChange(granted ? [...without, ...target] : without)
  }

  if (catalog.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>
  }

  if (variant === 'flat') {
    return (
      <div className={styles.flatList}>
        {catalog.map((feature) => (
          <div className={styles.flatRow} key={feature.key}>
            <div className={styles.flatLabel}>
              <span className={styles.featureName}>{feature.displayName}</span>
            </div>
            <div className={styles.flatCapabilities}>
              {feature.capabilities.map((capability) => (
                <Checkbox
                  key={capability.key}
                  label={capability.displayName}
                  checked={has(feature.key, capability.key)}
                  disabled={disabled}
                  onChange={() => toggle(feature.key, capability.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.moduleList}>
      {catalog.map((feature) => {
        const isCollapsed = collapsed.has(feature.key)
        const panelId = `permission-module-${feature.key}`

        // Rows are the sub-modules. A feature with none still renders one row for itself, so an app
        // on the old flat contract shows up as a normal single-row grid rather than an empty card.
        const rows = feature.children.length > 0 ? feature.children : [feature]

        // Column set = union of what these rows actually declare, in first-seen order.
        const columns: string[] = []
        for (const row of rows) {
          for (const capability of row.capabilities) {
            if (!columns.includes(capability.key)) columns.push(capability.key)
          }
        }

        const total = allGrantsFor(feature).length
        const grantedCount = allGrantsFor(feature).filter((g) => has(g.featureKey, g.capability)).length

        return (
          <section className={styles.moduleCard} key={feature.key}>
            <div className={styles.moduleHeader}>
              <button
                type="button"
                className={styles.moduleToggle}
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (next.has(feature.key)) next.delete(feature.key)
                    else next.add(feature.key)
                    return next
                  })
                }
              >
                <span className={isCollapsed ? styles.chevronCollapsed : styles.chevron} aria-hidden="true">
                  <Icon.ChevronDown width={16} height={16} />
                </span>
                <span className={styles.moduleText}>
                  <span className={styles.moduleName}>{feature.displayName}</span>
                  <span className={styles.moduleKey}>{feature.key}</span>
                </span>
              </button>

              <div className={styles.moduleMeta}>
                <Badge tone={grantedCount > 0 ? 'primary' : 'neutral'}>
                  {grantedCount} of {total}
                </Badge>
                {!disabled && (
                  <button
                    type="button"
                    className={styles.selectAll}
                    onClick={() => setAll(feature, grantedCount < total)}
                  >
                    {grantedCount < total ? 'Select all' : 'Clear all'}
                  </button>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <div className={styles.tableWrap} id={panelId}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.permissionHeader}>
                        Permission
                      </th>
                      {columns.map((column) => (
                        <th scope="col" key={column} className={styles.actionHeader}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row" className={styles.rowLabel}>
                          {row.displayName}
                        </th>
                        {columns.map((column) => {
                          const declared = row.capabilities.some((c) => c.key === column)
                          return (
                            <td key={column} className={styles.cell}>
                              {declared ? (
                                <Checkbox
                                  checked={has(row.key, column)}
                                  disabled={disabled}
                                  onChange={() => toggle(row.key, column)}
                                  aria-label={`${column} ${row.displayName}`}
                                />
                              ) : (
                                // This sub-module genuinely has no such action. An empty cell is
                                // honest; a disabled checkbox would imply the permission exists.
                                <span className={styles.notApplicable} aria-label="Not applicable">
                                  —
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
