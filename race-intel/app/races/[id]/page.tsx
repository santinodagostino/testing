export default function RaceDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Race Detail</h1>
      <p className="text-muted-foreground">Race ID: {params.id}</p>
      <div className="h-96 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
        Race detail coming in Phase 6
      </div>
    </div>
  );
}
