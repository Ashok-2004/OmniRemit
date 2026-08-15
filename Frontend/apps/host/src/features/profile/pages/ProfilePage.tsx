import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { Button } from '../../../shared/components/Button/Button'
import { Badge } from '../../../shared/components/Badge/Badge'
import styles from './ProfilePage.module.css'

function formatDateTime(iso: string | null) {
  if (!iso) return 'Never'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/**
 * Read-only — every field is sourced straight from authStore.user (CurrentUserDto, itself always
 * a live server response, never client-derived). No Change Password affordance: no self-service
 * password flow exists anywhere in the app today, and Google-provisioned accounts have no password
 * to change in the first place.
 */
export function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  if (!user) return null

  const initial = user.name.trim().charAt(0).toUpperCase() || '?'
  const isGoogle = user.authProvider === 'Google'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>My Profile</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>

      <div className={styles.panel}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <div>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.email}>{user.email}</div>
          </div>
        </div>

        <dl className={styles.detailList}>
          <dt>Full name</dt>
          <dd>{user.name}</dd>

          <dt>Email</dt>
          <dd>{user.email}</dd>

          <dt>Role</dt>
          <dd>
            {user.isAdministrator ? (
              <Badge tone="primary">Administrator</Badge>
            ) : (
              (user.roleName ?? <Badge tone="neutral">No role</Badge>)
            )}
          </dd>

          <dt>Authentication method</dt>
          <dd>{isGoogle ? 'Google SSO' : 'Local Password'}</dd>

          <dt>Status</dt>
          <dd>
            <Badge tone={user.isActive ? 'success' : 'neutral'} dot>
              {user.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </dd>

          <dt>Last login</dt>
          <dd>{formatDateTime(user.lastLoginAt)}</dd>
        </dl>

        {isGoogle && <div className={styles.ssoNotice}>Password is managed by Google Workspace.</div>}
      </div>
    </div>
  )
}
