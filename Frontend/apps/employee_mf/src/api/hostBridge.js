/**
 * Thin accessor for the host's runtime contract — window.__omniremitHost__, installed once at host
 * boot (see Frontend/apps/host/src/shared/federation/hostBridge.ts). This remote never manages its
 * own login or makes its own permission-check network calls: it always reads the CURRENT access
 * token / capabilities from the host at call time, the same way the host's own pages do.
 */

let warnedMissingBridge = false;

function getBridge() {
  const bridge = typeof window !== "undefined" ? window.__omniremitHost__ : undefined;
  if (!bridge && !warnedMissingBridge) {
    warnedMissingBridge = true;
    console.warn(
      "[employee_mf] window.__omniremitHost__ is not installed — this remote is designed to run " +
        "inside the OmniRemit host shell. API calls will be unauthenticated and will fail.",
    );
  }
  return bridge ?? null;
}

export const getAccessToken = () => getBridge()?.getAccessToken() ?? null;

export const ensureFreshAccessToken = () =>
  getBridge()?.ensureFreshAccessToken() ??
  Promise.reject(new Error("employee_mf is not running inside the OmniRemit host — no access token available."));

export const hasCapability = (featureKey, capability) => getBridge()?.hasCapability(featureKey, capability) ?? false;

export const getCurrentUser = () => getBridge()?.getUser() ?? null;

export const getAuthServiceBaseUrl = () => getBridge()?.apiBaseUrls?.authService ?? "";

/** This app's own PermissionFeatureKey once registered in ModuleRegistry (RemoteApp.Key = "employee") — mirrors Backend/EmployeeService's RequiresCapabilityAttribute.FeatureKey. */
export const EMPLOYEE_FEATURE_KEY = "remote.employee";

/** The host feature gating AuthService's own Users CRUD — needed in addition to EMPLOYEE_FEATURE_KEY:Create because "Add Member" here also provisions a platform login for that person. */
export const USERS_FEATURE_KEY = "host.settings.users";
