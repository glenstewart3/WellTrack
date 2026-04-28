import React from 'react';
import { Users, Upload, Search, ClipboardList, ArrowRight } from 'lucide-react';

/**
 * Empty State Component
 * Shows actionable guides instead of blank tables
 */
export function EmptyState({
  type = 'students',
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
  icon: CustomIcon
}) {
  // Predefined configurations for common empty states
  const configs = {
    students: {
      title: 'No students yet',
      description: 'Get started by adding students to your school. You can import from a CSV file or add them one by one.',
      icon: Users,
      action: {
        label: 'Import from CSV',
        icon: Upload
      },
      secondaryAction: {
        label: 'Add Student',
        icon: Users
      }
    },
    students_filtered: {
      title: 'No students match your filters',
      description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
      icon: Search,
      action: {
        label: 'Clear Filters',
        icon: Search
      }
    },
    screenings: {
      title: 'No screenings this term',
      description: 'Start collecting SAEBRS data to identify students who may need support.',
      icon: ClipboardList,
      action: {
        label: 'Start Screening',
        icon: ClipboardList
      }
    },
    interventions: {
      title: 'No active interventions',
      description: 'Review your Tier 2 and Tier 3 students to identify who may benefit from targeted support.',
      icon: ClipboardList,
      action: {
        label: 'Review Students',
        icon: Users
      }
    },
    interventions_filtered: {
      title: 'No interventions match your filters',
      description: 'Try adjusting your search or filter criteria.',
      icon: Search,
      action: {
        label: 'Clear Filters',
        icon: Search
      }
    },
    attendance: {
      title: 'No attendance records',
      description: 'Start tracking student attendance to identify chronic absence patterns.',
      icon: ClipboardList,
      action: {
        label: 'Record Attendance',
        icon: ClipboardList
      }
    },
    archived: {
      title: 'No archived students',
      description: 'Archived students will appear here. You can restore them at any time.',
      icon: Users
    }
  };

  const config = configs[type] || {};
  const Icon = CustomIcon || config.icon || Users;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-400" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title || config.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        {description || config.description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            {action.icon && <action.icon size={16} />}
            {action.label}
          </button>
        )}

        {!action && config.action && (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            {config.action.icon && <config.action.icon size={16} />}
            {config.action.label}
            <ArrowRight size={14} />
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            {secondaryAction.icon && <secondaryAction.icon size={16} />}
            {secondaryAction.label}
          </button>
        )}

        {!secondaryAction && config.secondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            {config.secondaryAction.icon && <config.secondaryAction.icon size={16} />}
            {config.secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
