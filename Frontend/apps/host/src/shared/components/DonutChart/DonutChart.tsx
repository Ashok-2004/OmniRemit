import { useId } from 'react'
import styles from './DonutChart.module.css'

export interface DonutSegment {
  label: string
  value: number
  /** CSS colour. Callers pass tokens so the palette stays centralised. */
  color: string
}

export interface DonutChartProps {
  segments: DonutSegment[]
  /** Word under the centre total, e.g. "Total". */
  centerLabel?: string
  size?: number
  thickness?: number
}

const RADIUS = 60

/**
 * Donut with a centre total and a legend, drawn as inline SVG.
 *
 * Hand-authored rather than pulling in a charting library: this and the bar list are the only two
 * charts in the product, and a chart dependency would also have to be added to the Module Federation
 * shared config or every remote app would bundle its own copy.
 *
 * Segments are drawn with stroke-dasharray on a single circle — no arc path maths, no rounding
 * artefacts where segments meet, and a zero-value segment simply renders nothing.
 */
export function DonutChart({ segments, centerLabel = 'Total', size = 176, thickness = 22 }: DonutChartProps) {
  const titleId = useId()
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const circumference = 2 * Math.PI * RADIUS

  // Running offset so each segment starts where the previous ended.
  let offset = 0

  return (
    <div className={styles.wrapper}>
      <div className={styles.chart} style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            {total === 0
              ? 'No data to chart'
              : segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
          </title>

          {/* Track, so an empty or partial donut still reads as a ring rather than a fragment. */}
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke="var(--omni-color-surface-sunken)"
            strokeWidth={thickness}
          />

          {total > 0 &&
            segments.map((segment) => {
              if (segment.value <= 0) return null
              const length = (segment.value / total) * circumference
              const dash = `${length} ${circumference - length}`
              // -90deg so the first segment starts at 12 o'clock, which is what the eye expects.
              const rotation = (offset / circumference) * 360 - 90
              offset += length

              return (
                <circle
                  key={segment.label}
                  cx="80"
                  cy="80"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  transform={`rotate(${rotation} 80 80)`}
                  className={styles.segment}
                />
              )
            })}
        </svg>

        <div className={styles.center}>
          <span className={styles.centerValue}>{total.toLocaleString()}</span>
          <span className={styles.centerLabel}>{centerLabel}</span>
        </div>
      </div>

      <ul className={styles.legend}>
        {segments.map((segment) => {
          const percent = total === 0 ? 0 : Math.round((segment.value / total) * 100)
          return (
            <li className={styles.legendRow} key={segment.label}>
              <span className={styles.dot} style={{ background: segment.color }} aria-hidden="true" />
              <span className={styles.legendLabel}>{segment.label}</span>
              <span className={styles.legendValue}>
                {segment.value.toLocaleString()} ({percent}%)
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
