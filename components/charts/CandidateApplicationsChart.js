import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function CandidateApplicationsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid
          stroke="var(--border-strong)"
          vertical={false}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="name"
          stroke="var(--text-3)"
          fontSize={14}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-1)',
            boxShadow: 'none',
          }}
          labelStyle={{ color: 'var(--text-1)', fontWeight: 700 }}
          itemStyle={{ color: 'var(--blue)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--blue)"
          fill="var(--sky)"
          fillOpacity={0.18}
          strokeWidth={2.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
