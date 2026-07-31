export default function MasteryRing({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div className="ring" style={{ ['--p' as any]: value }}><div>{value}%</div></div>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}