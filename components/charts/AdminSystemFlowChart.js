import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, Tooltip } from 'recharts';

export default function AdminSystemFlowChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
        <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: 'white' }} />
        <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

