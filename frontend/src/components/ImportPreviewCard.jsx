import React from 'react';

/**
 * Reusable dry-run preview card for bulk imports.
 *
 * Used by:
 *   - SettingsPage → Imports tab (student imports)
 *   - AdministrationPage → User Management → Staff upload modal
 *
 * Renders a detection banner (file-kind mismatch warning), add/update/skip/error
 * count tiles, and collapsible per-row lists. Purely presentational — the
 * parent component owns the upload/commit flow.
 */
export default function ImportPreviewCard({ kind, preview, testIdPrefix }) {
  const expected = kind; // 'staff' | 'student'
  const detected = preview?.file_kind?.looks_like;
  const mismatch = detected && detected !== 'unknown' && detected !== expected;
  const counts = preview?.counts || {};

  const kindLabel = kind === 'staff' ? 'Staff' : 'Student';
  const bannerCls = mismatch
    ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800'
    : detected === expected
      ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800'
      : 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800';

  return (
    <div className="mt-3 space-y-3" data-testid={testIdPrefix}>
      <div
        className={`p-3 rounded-xl border text-xs ${bannerCls}`}
        data-testid={`${testIdPrefix}-banner`}
        data-looks-like={detected || 'unknown'}
        data-mismatch={mismatch ? 'true' : 'false'}
      >
        <div className="flex items-center gap-2 font-semibold">
          {mismatch ? (
            <span className="text-rose-700 dark:text-rose-300">
              ⚠ This file looks like a <strong>{detected}</strong> file, not a {kindLabel.toLowerCase()} file. Double-check before importing.
            </span>
          ) : detected === expected ? (
            <span className="text-emerald-700 dark:text-emerald-300">
              ✓ Detected a {kindLabel.toLowerCase()} file — <strong>{preview.total_rows}</strong> row{preview.total_rows !== 1 ? 's' : ''} parsed
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              Couldn't confidently identify this as a {kindLabel.toLowerCase()} file. Review the planned changes below.
            </span>
          )}
        </div>
        {preview.file_kind?.headers?.length > 0 && (
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Detected columns: <span className="font-mono">{preview.file_kind.headers.slice(0, 10).join(', ')}{preview.file_kind.headers.length > 10 ? '…' : ''}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" data-testid={`${testIdPrefix}-counts`}>
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900">
          <div className="font-bold text-lg text-emerald-700 dark:text-emerald-300" data-testid={`${testIdPrefix}-count-add`}>{counts.add || 0}</div>
          <div className="text-emerald-700/70 dark:text-emerald-300/70">will be added</div>
        </div>
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <div className="font-bold text-lg text-blue-700 dark:text-blue-300" data-testid={`${testIdPrefix}-count-update`}>{counts.update || 0}</div>
          <div className="text-blue-700/70 dark:text-blue-300/70">will be updated</div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
          <div className="font-bold text-lg text-slate-700 dark:text-slate-200" data-testid={`${testIdPrefix}-count-skip`}>{counts.skip || 0}</div>
          <div className="text-slate-500 dark:text-slate-400">will be skipped</div>
        </div>
        <div className={`p-3 rounded-xl border ${counts.errors ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900' : 'border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700'}`}>
          <div className={`font-bold text-lg ${counts.errors ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`} data-testid={`${testIdPrefix}-count-errors`}>{counts.errors || 0}</div>
          <div className={counts.errors ? 'text-rose-700/70 dark:text-rose-300/70' : 'text-slate-500 dark:text-slate-400'}>errors</div>
        </div>
      </div>

      {kind === 'staff' && preview.uncategorised?.length > 0 && (
        <details className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          <summary className="cursor-pointer font-medium">
            {preview.uncategorised.length} row{preview.uncategorised.length !== 1 ? 's have' : ' has'} unknown payroll class → defaulting to Teacher (review after import)
          </summary>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
            {preview.uncategorised.slice(0, 15).map((u, i) => (
              <li key={i}>{u.name} ({u.email}) — <code>{u.payroll_class || '∅'}</code></li>
            ))}
          </ul>
        </details>
      )}

      {preview.add?.length > 0 && (
        <details className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3" data-testid={`${testIdPrefix}-add-list`}>
          <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-300">
            + {counts.add} will be added {preview.add.length < (counts.add || 0) ? `(showing first ${preview.add.length})` : ''}
          </summary>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
            {preview.add.slice(0, 20).map((r, i) => (
              <li key={i}>
                {kind === 'staff'
                  ? <>{r.name} · {r.email} — <strong>{r.role}</strong>{r.uncategorised ? ' (uncategorised)' : ''}</>
                  : <>{r.name} {r.year_level ? `· ${r.year_level}` : ''} {r.class_name ? `· ${r.class_name}` : ''} {r.gender ? `· ${r.gender}` : ''}</>
                }
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.update?.length > 0 && (
        <details className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3" data-testid={`${testIdPrefix}-update-list`}>
          <summary className="cursor-pointer font-medium text-blue-700 dark:text-blue-300">
            ↻ {counts.update} will be updated {preview.update.length < (counts.update || 0) ? `(showing first ${preview.update.length})` : ''}
          </summary>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
            {preview.update.slice(0, 20).map((r, i) => (
              <li key={i}>
                {kind === 'staff'
                  ? <>{r.name} · {r.email} → changes: <strong>{(r.changes || []).join(', ') || '—'}</strong></>
                  : <>{r.name} → changes: <strong>{(r.changes || []).join(', ') || '—'}</strong></>
                }
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.errors?.length > 0 && (
        <details className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-3" data-testid={`${testIdPrefix}-errors-list`}>
          <summary className="cursor-pointer font-medium">{counts.errors} error{counts.errors !== 1 ? 's' : ''} — these rows will be skipped</summary>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
            {preview.errors.slice(0, 20).map((e, i) => (
              <li key={i}>Row {e.row}: {e.error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
