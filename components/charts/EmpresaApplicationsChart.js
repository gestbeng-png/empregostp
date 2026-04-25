import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function EmpresaApplicationsChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="empresaColorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2057d7" stopOpacity={0.24} />
            <stop offset="95%" stopColor="#2057d7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="rgba(148,163,184,0.16)"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="#607394"
          axisLine={false}
          tickLine={false}
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid rgba(148,163,184,0.14)",
            borderRadius: "10px",
            boxShadow: "0 12px 28px rgba(15,23,42,0.1)",
          }}
          labelStyle={{ color: "#162a55", fontWeight: 700 }}
          itemStyle={{ color: "#2057d7" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2057d7"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#empresaColorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
