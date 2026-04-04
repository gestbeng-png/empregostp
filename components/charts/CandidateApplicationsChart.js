import { ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid, Tooltip } from 'recharts';

export default function CandidateApplicationsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#0b1223', border: 'none', borderRadius: '12px' }} />
        <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

