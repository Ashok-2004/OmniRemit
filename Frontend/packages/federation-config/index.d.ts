/** Type surface for the shared federation preset. Kept hand-written and tiny — the package is plain ESM config, not compiled source. */

export interface SharedDependencyConfig {
  singleton: boolean
  requiredVersion: string
}

export declare const sharedDependencies: Record<string, SharedDependencyConfig>

export declare const REMOTE_ENTRY_MODULE: './App'

export declare const BASELINE_SHARED: string[]

export interface RemoteFederationOptions {
  name: string
  filename: string
  manifest: boolean
  dts: boolean
  exposes: Record<string, string>
  shared: Record<string, SharedDependencyConfig>
}

export interface HostFederationOptions {
  name: string
  shared: Record<string, SharedDependencyConfig>
}

export declare function remoteFederationConfig(name: string, entry: string, uses?: string[]): RemoteFederationOptions

export declare function hostFederationConfig(name: string, provides?: string[]): HostFederationOptions
