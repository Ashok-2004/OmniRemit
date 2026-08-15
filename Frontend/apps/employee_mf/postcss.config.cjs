/**
 * CSS isolation for this remote app.
 *
 * A remote's stylesheet is injected into the HOST's document, so anything global in it leaks into
 * the host and into every other remote on the page. Two plugins close that off:
 *
 *  1. postcss-prefix-selector — scopes every *selector* under `#employee-mf-scope`, the id on this
 *     app's root element.
 *  2. scopeKeyframes (below) — scopes every `@keyframes` *name*, which the selector prefixer does
 *     not and cannot touch, because keyframes names live in a separate global namespace.
 *
 * Both are needed. Selector prefixing alone left a real collision: this app defined `@keyframes
 * fadeIn` and `slideUp` at global scope, so a second remote app defining its own `fadeIn` would
 * silently overwrite this one (last stylesheet injected wins) and animations would visibly break in
 * whichever app lost. Scoping the names removes the shared namespace entirely.
 */

const SCOPE_ID = 'employee-mf-scope'

/**
 * Renames every `@keyframes` to `<scope>-<name>` and rewrites every reference to it.
 *
 * References are rewritten in `animation-name` (where the value is just names) and in the
 * `animation` shorthand. For the shorthand we only replace a whole-word match of a name we actually
 * declared in this stylesheet — so timing functions, durations and keywords (`ease-out`, `1s`,
 * `infinite`) are never touched, and an animation name coming from somewhere else is left alone.
 */
function scopeKeyframes() {
  return {
    postcssPlugin: 'omniremit-scope-keyframes',
    OnceExit(root) {
      const declared = new Set()

      root.walkAtRules(/^(-\w+-)?keyframes$/, (atRule) => {
        if (atRule.params.startsWith(`${SCOPE_ID}-`)) {
          return
        }
        declared.add(atRule.params)
        atRule.params = `${SCOPE_ID}-${atRule.params}`
      })

      if (declared.size === 0) {
        return
      }

      root.walkDecls(/^(-\w+-)?animation(-name)?$/, (decl) => {
        for (const name of declared) {
          // \b would not treat a leading hyphen as a boundary; an explicit character class keeps
          // names like "fade" from matching inside "fade-out".
          const pattern = new RegExp(`(^|[^\\w-])${name}(?![\\w-])`, 'g')
          decl.value = decl.value.replace(pattern, `$1${SCOPE_ID}-${name}`)
        }
      })
    },
  }
}
scopeKeyframes.postcss = true

module.exports = {
  plugins: [
    require('postcss-prefix-selector')({
      prefix: `#${SCOPE_ID}`,
      transform(prefix, selector, prefixedSelector) {
        // `:root`, `html` and `body` all refer to "the root of this app's subtree" once embedded,
        // which is the scope element itself — NOT a descendant of it. Returning the bare prefix is
        // what lets base/reset styles and CSS custom properties actually land on the root element.
        if (selector === 'body' || selector === 'html' || selector === ':root') {
          return prefix
        }
        return prefixedSelector
      },
    }),
    scopeKeyframes(),
  ],
}
