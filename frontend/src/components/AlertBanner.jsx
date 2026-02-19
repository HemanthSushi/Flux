export default function AlertBanner({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200">
      <p className="mb-2 font-bold">Overspending alerts</p>
      <ul className="list-disc space-y-1 pl-4">
        {alerts.map((alert, idx) => (
          <li key={`${alert}-${idx}`}>{alert}</li>
        ))}
      </ul>
    </div>
  );
}
