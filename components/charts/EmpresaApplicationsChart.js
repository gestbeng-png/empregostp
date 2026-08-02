import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function EmpresaApplicationsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="var(--text-3)"
          axisLine={false}
          tickLine={false}
          fontSize={14}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: 'none',
          }}
          labelStyle={{ color: 'var(--text-1)', fontWeight: 700 }}
          itemStyle={{ color: 'var(--blue)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--blue)"
          strokeWidth={2.5}
          fillOpacity={0.18}
          fill="var(--sky)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
