import React from 'react';
import { 
  FileEdit, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle 
} from 'lucide-react';
import { ExerciseStatus } from '../../types/index.ts';

interface StatusBadgeProps {
  status: ExerciseStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs = {
    draft: {
      label: 'ฉบับร่าง',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: FileEdit,
    },
    pending: {
      label: 'รอตรวจ',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Clock,
    },
    approved: {
      label: 'ผ่านการตรวจแล้ว',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: CheckCircle2,
    },
    needs_revision: {
      label: 'ต้องแก้ไข',
      color: 'bg-orange-50 text-orange-800 border-orange-200',
      icon: AlertCircle,
    },
    rejected: {
      label: 'ไม่ผ่าน',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: XCircle,
    },
  };

  const config = configs[status] || configs.draft;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs md:text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-sm md:text-base px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-2xs ${config.color} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};
