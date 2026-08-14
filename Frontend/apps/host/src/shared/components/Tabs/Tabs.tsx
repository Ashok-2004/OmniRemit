import { classNames } from '../../utils/classNames'
import styles from './Tabs.module.css'

export interface TabItem {
  key: string
  label: string
}

export interface TabsProps {
  items: TabItem[]
  activeKey: string
  onChange: (key: string) => void
}

export function Tabs({ items, activeKey, onChange }: TabsProps) {
  return (
    <div className={styles.tablist} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === activeKey}
          className={classNames(styles.tab, item.key === activeKey && styles.tabActive)}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
