interface PlatformStatCardProps {
  label: string;
  value: number | string;
  subLabel?: string;
  icon: React.ReactNode;
  colorClass: string;
  onClick?: () => void;
  badge?: { text: string; color: string };
}

export default function PlatformStatCard({
  label,
  value,
  subLabel,
  icon,
  colorClass,
  onClick,
  badge,
}: PlatformStatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
      }`}
      onClick={onClick}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">{value}</p>
        {subLabel && <p className="text-xs text-slate-400 mt-0.5 truncate">{subLabel}</p>}
        {badge && (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mt-1 ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}
