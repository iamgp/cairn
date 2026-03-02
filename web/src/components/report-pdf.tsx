import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { RunCheck, RunRecord } from '../lib/history'
import { runDuration, runStatus } from '../lib/history'

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#6B7280',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: {
    width: 100,
    fontWeight: 600,
    color: '#6B7280',
  },
  rowValue: {
    flex: 1,
    color: '#111827',
  },
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderCell: {
    padding: 4,
    fontWeight: 600,
    fontSize: 7,
    textTransform: 'uppercase',
    color: '#6B7280',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCell: {
    padding: 4,
    fontSize: 7,
  },
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 6,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  statusPassed: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  statusSkipped: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  summaryRow: {
    flexDirection: 'row',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  summaryCell: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 8,
  },
  checkSection: {
    marginTop: 10,
  },
  checkHeader: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 2,
  },
  checkMeta: {
    fontSize: 7,
    color: '#6B7280',
    marginBottom: 4,
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 6,
    color: '#9CA3AF',
  },
})

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString()
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let style = styles.statusPassed
  if (s === 'failed' || s === 'error') style = styles.statusFailed
  else if (s === 'skipped') style = styles.statusSkipped

  return (
    <View style={[styles.statusBadge, style]}>
      <Text>{status}</Text>
    </View>
  )
}

interface ReportPdfProps {
  run: RunRecord
}

export function ReportPdfDocument({ run }: ReportPdfProps) {
  const status = runStatus(run)
  const checks = run.checks || []

  const env = run.metadata?.environment
  const actor = run.metadata?.actor
  const repro = run.metadata?.reproducibility
  const cov = run.metadata?.coverage?.overall

  const details = [
    run.pr ? { label: 'PR', value: `#${run.pr}` } : null,
    { label: 'Branch', value: run.branch || '-' },
    run.sha_full ? { label: 'Commit', value: run.sha_full } : null,
    { label: 'Date', value: formatTimestamp(run.timestamp) },
    { label: 'Duration', value: `${runDuration(run).toFixed(2)}s` },
    { label: 'Status', value: status, isStatus: true },
    env?.repository ? { label: 'Repository', value: env.repository } : null,
    env?.workflow ? { label: 'Workflow', value: env.workflow } : null,
    actor?.login ? { label: 'Triggered By', value: actor.login } : null,
    env?.provider ? { label: 'CI Provider', value: env.provider } : null,
    env?.runner_os ? { label: 'Runner', value: env.runner_os } : null,
    run.matrix ? { label: 'Matrix', value: Object.entries(run.matrix).map(([k, v]) => `${k}: ${v}`).join(', ') } : null,
    repro?.tool_versions ? { label: 'Tools', value: Object.entries(repro.tool_versions).map(([k, v]) => `${k}: ${v}`).join(', ') } : null,
    cov?.line ? { label: 'Line Coverage', value: `${cov.line.percent?.toFixed(1)}% (${cov.line.covered}/${cov.line.total})` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string | React.ReactNode; isStatus?: boolean }>

  let passed = 0, failed = 0, skipped = 0
  for (const check of checks) {
    for (const item of check.items || []) {
      const s = (item.status || '').toLowerCase()
      if (s === 'passed') passed++
      else if (s === 'failed' || s === 'error') failed++
      else if (s === 'skipped') skipped++
    }
  }
  const total = passed + failed + skipped

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Test Report</Text>
          <Text style={styles.subtitle}>{run.run_id}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {details.map((detail, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{detail.label}</Text>
              {detail.isStatus ? (
                <StatusBadge status={detail.value as string} />
              ) : (
                <Text style={styles.rowValue}>{detail.value as string}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.table}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryCell}>Total</Text>
              <Text style={styles.summaryCell}>Passed</Text>
              <Text style={styles.summaryCell}>Failed</Text>
              <Text style={[styles.summaryCell, { borderRightWidth: 0 }]}>Skipped</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryCell, { color: '#111827' }]}>{total}</Text>
              <Text style={[styles.summaryCell, { color: '#166534' }]}>{passed}</Text>
              <Text style={[styles.summaryCell, { color: '#991B1B' }]}>{failed}</Text>
              <Text style={[styles.summaryCell, { color: '#92400E', borderRightWidth: 0 }]}>{skipped}</Text>
            </View>
          </View>
        </View>

        {checks.map((check) => (
          <View key={check.tool} style={styles.checkSection}>
            <Text style={styles.checkHeader}>{check.tool}</Text>
            <Text style={styles.checkMeta}>
              {check.items?.length || 0} items
              {typeof check.duration_s === 'number' && ` (${check.duration_s.toFixed(3)}s)`}
            </Text>

            {(check.items?.length || 0) > 0 && (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Status</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Check</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Duration</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Message</Text>
                </View>
                {check.items?.map((item, i) => {
                  const s = (item.status || '').toLowerCase()
                  return (
                    <View key={i} style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 0.8 }]}>
                        <StatusBadge status={s} />
                      </View>
                      <Text style={[styles.tableCell, styles.mono, { flex: 2 }]}>{item.id}</Text>
                      <Text style={[styles.tableCell, styles.mono, { flex: 0.7 }]}>
                        {item.duration_s != null ? `${(item.duration_s * 1000).toFixed(1)}ms` : '-'}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{item.message || '-'}</Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        ))}

        <Text style={styles.footer}>Generated by Cairn</Text>
      </Page>
    </Document>
  )
}
