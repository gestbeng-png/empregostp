import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function AdminSystemFlowChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-strong)"
          vertical={false}
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
        <Bar
          dataKey="value"
          fill="var(--blue)"
          radius={[4, 4, 0, 0]}
          barSize={34}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
