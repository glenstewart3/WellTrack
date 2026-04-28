import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { getTierColors, getRiskColors } from '../utils/tierUtils';

/**
 * Mobile-optimized student card view
 * Displays student info in a card format suitable for touch interfaces
 */
export function MobileStudentCard({ student, bulkEditMode, selectedIds, onToggleSelect, onOpenEdit }) {
  const navigate = useNavigate();
  const colors = getTierColors(student.mtss_tier);
  const riskColors = getRiskColors(student.risk_level);

  const handleClick = (e) => {
    if (bulkEditMode) {
      onOpenEdit?.(student, e);
    } else {
      navigate(`/students/${student.student_id}`);
    }
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggleSelect?.(student.student_id, e);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white border border-slate-200 rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
        selectedIds?.has(student.student_id) ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-slate-300'
      }`}
    >
      {/* Header: Avatar + Name + Checkbox */}
      <div className="flex items-start gap-3">
        {bulkEditMode && (
          <div className="pt-1" onClick={handleCheckboxClick}>
            <input
              type="checkbox"
              checked={selectedIds?.has(student.student_id)}
              onChange={handleCheckboxClick}
              className="rounded border-slate-300 cursor-pointer w-5 h-5"
            />
          </div>
        )}

        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            backgroundColor: student.mtss_tier === 3 ? 'var(--wt-tier3-soft)'
              : student.mtss_tier === 2 ? 'var(--wt-tier2-soft)'
              : student.mtss_tier === 1 ? 'var(--wt-tier1-soft)'
              : 'var(--wt-surface-muted)',
          }}
        >
          {student.photo_url ? (
            <img
              src={`${process.env.REACT_APP_BACKEND_URL}${student.photo_url}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: 'Manrope, sans-serif',
                color: student.mtss_tier === 3 ? 'var(--wt-tier3-foreground)'
                  : student.mtss_tier === 2 ? 'var(--wt-tier2-foreground)'
                  : student.mtss_tier === 1 ? 'var(--wt-tier1-foreground)'
                  : 'var(--wt-foreground)',
              }}
            >
              {student.first_name[0]}{student.last_name[0]}
            </span>
          )}
        </div>

        {/* Name and basic info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight">
            {student.first_name}
            {student.preferred_name && student.preferred_name !== student.first_name && (
              <span className="text-slate-500"> ({student.preferred_name})</span>
            )}{' '}
            {student.last_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{student.class_name}</p>

          {/* EAL/Aboriginal badges */}
          {(student.eal_status && student.eal_status !== 'Not EAL') || student.aboriginal_status === 'Aboriginal' ? (
            <div className="flex gap-1 mt-2 flex-wrap">
              {student.eal_status && student.eal_status !== 'Not EAL' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                  {student.eal_status.includes('< 5') ? 'EAL <5yr' : student.eal_status.includes('>=5') ? 'EAL 5-7yr' : student.eal_status.includes('Fee') ? 'EAL Fee' : 'EAL'}
                </span>
              )}
              {student.aboriginal_status === 'Aboriginal' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                  Aboriginal
                </span>
              )}
            </div>
          ) : null}
        </div>

        <ChevronRight size={20} className="text-slate-400 shrink-0 mt-1" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
        {/* Tier */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tier</p>
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
            style={{ backgroundColor: colors.soft, color: colors.foreground }}
          >
            {student.mtss_tier || '-'}
          </span>
        </div>

        {/* SAEBRS */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">SAEBRS</p>
          <span className={`text-sm font-semibold ${riskColors.text}`}>
            {student.saebrs_total ?? '-'}
          </span>
        </div>

        {/* Attendance */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Attend</p>
          <span className={`text-sm font-semibold ${
            student.attendance_pct < 90 ? 'text-rose-600' : 'text-slate-700'
          }`}>
            {student.attendance_pct !== null ? `${Math.round(student.attendance_pct)}%` : '-'}
          </span>
          {student.attendance_pct < 90 && (
            <AlertTriangle size={12} className="inline ml-1 text-rose-500" />
          )}
        </div>

        {/* Interventions */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Interv</p>
          <span className="text-sm font-semibold text-slate-700">
            {student.intervention_count || 0}
          </span>
        </div>
      </div>

      {/* Domain breakdown (if screened) */}
      {(student.social_raw !== undefined || student.academic_raw !== undefined || student.emotional_raw !== undefined) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-slate-50">
          {student.social_raw !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">S:</span>
              <span className="font-medium text-slate-600">{student.social_raw}</span>
            </div>
          )}
          {student.academic_raw !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">A:</span>
              <span className="font-medium text-slate-600">{student.academic_raw}</span>
            </div>
          )}
          {student.emotional_raw !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">E:</span>
              <span className="font-medium text-slate-600">{student.emotional_raw}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MobileStudentCard;
