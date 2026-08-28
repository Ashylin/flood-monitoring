interface Props {
  label: string;
  value: string;
  sub?: string;
}

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
