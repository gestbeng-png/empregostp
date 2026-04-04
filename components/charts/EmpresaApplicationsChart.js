import { ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid, Tooltip } from 'recharts';

export default function EmpresaApplicationsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="empresaColorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" stroke="#52525b" axisLine={false} tickLine={false} fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}
          labelStyle={{ color: '#fff', fontWeight: 600 }}
          itemStyle={{ color: '#a5b4fc' }}
        />
        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#empresaColorValue)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

