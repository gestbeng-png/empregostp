import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AdminSystemFlowChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(21, 37, 79, 0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="#607394"
          fontSize={12}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid rgba(21, 37, 79, 0.08)",
            borderRadius: "12px",
            color: "#162a55",
            boxShadow: "0 18px 30px rgba(15, 23, 42, 0.08)",
          }}
        />
        <Bar
          dataKey="value"
          fill="#2057d7"
          radius={[10, 10, 0, 0]}
          barSize={34}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
