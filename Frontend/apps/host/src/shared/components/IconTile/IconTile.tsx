import type { ReactNode } from 'react'
import styles from './IconTile.module.css'

export type IconTileTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type IconTileSize = 'sm' | 'md' | 'lg'

export interface IconTileProps {
  children: ReactNode
  tone?: IconTileTone
  size?: IconTileSize
}

/**
 * The soft tinted rounded square that sits behind an icon.
 *
 * It appears in page headers, stat cards, table name cells and activity rows, and every one of those
 * was about to grow its own copy of the same background/radius/colour rules. Centralising it is what
 * keeps the tint and corner radius identical everywhere, which is most of why the reference designs
 * read as one system rather than several.
 */
export function IconTile({ children, tone = 'primary', size = 'md' }: IconTileProps) {
  return (
    <span className={`${styles.tile} ${styles[tone]} ${styles[size]}`} aria-hidden="true">
      {children}
    </span>
  )
}
