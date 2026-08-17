import type { ReactNode } from 'react'
import { IconTile, type IconTileTone } from '../IconTile/IconTile'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  icon?: ReactNode
  iconTone?: IconTileTone
  title: string
  description?: string
  /** Primary action(s), right-aligned. Wraps below the title on narrow viewports. */
  actions?: ReactNode
}

/**
 * The header every list page opens with: tinted icon tile, title, one-line description, actions.
 *
 * Shared rather than repeated per page because the three settings surfaces are meant to read as the
 * same product — inconsistent header spacing between Users and Roles is exactly the kind of thing
 * that makes an admin console feel assembled rather than designed.
 */
export function PageHeader({ icon, iconTone = 'primary', title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        {icon && (
          <IconTile tone={iconTone} size="lg">
            {icon}
          </IconTile>
        )}
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
