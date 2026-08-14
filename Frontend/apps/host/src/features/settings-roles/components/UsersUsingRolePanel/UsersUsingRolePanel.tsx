import { SkeletonText } from '../../../../shared/components/Skeleton'
import type { RoleUserDto } from '../../api/rolesApi'
import styles from './UsersUsingRolePanel.module.css'

export interface UsersUsingRolePanelProps {
  /** undefined while loading, [] once loaded with no assignments, undefined-vs-not-yet-saved handled by caller (new roles show a "save first" hint). */
  users?: RoleUserDto[]
  isNewRole?: boolean
}

export function UsersUsingRolePanel({ users, isNewRole }: UsersUsingRolePanelProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.title}>👥 List of users using this role</span>

      {isNewRole ? (
        <p className={styles.empty}>Save the role to start assigning users.</p>
      ) : users === undefined ? (
        <SkeletonText lines={3} />
      ) : users.length === 0 ? (
        <p className={styles.empty}>No users are assigned to this role yet.</p>
      ) : (
        <div className={styles.list}>
          {users.map((user) => (
            <div className={styles.userRow} key={user.id}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
