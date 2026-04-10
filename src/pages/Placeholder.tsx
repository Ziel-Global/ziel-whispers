export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">This module will be built in a future phase.</p>
    </div>
  );
}
