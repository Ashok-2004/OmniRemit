import { useEffect, useRef } from 'react'
import { useSettingsDrawerStore } from '../../shared/stores/settingsDrawerStore'
import { Icon } from '../../shared/components/Icon/Icon'
import { SettingsUsersTab } from './SettingsUsersTab'
import { SettingsRolesTab } from './SettingsRolesTab'
import { SettingsApplicationsTab } from './SettingsApplicationsTab'
import { RoleFormLayer } from './RoleFormLayer'
import { UserFormLayer } from './UserFormLayer'
import { ApplicationFormLayer } from './ApplicationFormLayer'
import styles from './SettingsDrawer.module.css'

export function SettingsDrawer() {
  const isOpen = useSettingsDrawerStore((s) => s.isOpen)
  const activeTab = useSettingsDrawerStore((s) => s.activeTab)
  const layerStack = useSettingsDrawerStore((s) => s.layerStack)
  const close = useSettingsDrawerStore((s) => s.close)
  const setActiveTab = useSettingsDrawerStore((s) => s.setActiveTab)
  const popLayer = useSettingsDrawerStore((s) => s.popLayer)
  const drawerRef = useRef<HTMLDivElement>(null)

  // ESC key to close or pop layer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (layerStack.length > 1) {
          popLayer()
        } else {
          close()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, layerStack.length, popLayer, close])

  if (!isOpen) return null

  const currentLayer = layerStack[layerStack.length - 1]
  const isOverrideLayer = layerStack.length > 1

  return (
    <div className={styles.overlayRoot}>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={close} />

      {/* Slide-over Drawer */}
      <div className={styles.drawerContainer} ref={drawerRef}>
        {isOverrideLayer ? (
          /* Override Layer (e.g. Edit Role, Add User, Add Application) */
          <div className={styles.overrideLayer}>
            {currentLayer.type === 'role-form' && (
              <RoleFormLayer roleId={currentLayer.roleId} initialTab={currentLayer.initialTab} />
            )}
            {currentLayer.type === 'user-form' && (
              <UserFormLayer userId={currentLayer.userId} />
            )}
            {currentLayer.type === 'app-form' && (
              <ApplicationFormLayer appId={currentLayer.appId} />
            )}
          </div>
        ) : (
          /* Root Settings Panel (Users / Roles / Applications) */
          <div className={styles.rootPanel}>
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <Icon.Settings width={20} height={20} />
                </div>
                <div>
                  <h2 className={styles.title}>System Settings</h2>
                  <p className={styles.subtitle}>Configure platform access, roles, and federated applications</p>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close Settings"
              >
                <Icon.X width={20} height={20} />
              </button>
            </div>

            {/* Horizontal Tabs */}
            <div className={styles.tabsNav}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Icon.Users width={16} height={16} />
                <span>Users</span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('roles')}
              >
                <Icon.ShieldCheck width={16} height={16} />
                <span>Roles</span>
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'applications' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('applications')}
              >
                <Icon.Grid width={16} height={16} />
                <span>Applications</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className={styles.tabBody}>
              {activeTab === 'users' && <SettingsUsersTab />}
              {activeTab === 'roles' && <SettingsRolesTab />}
              {activeTab === 'applications' && <SettingsApplicationsTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
