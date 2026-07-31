import { Loader2 } from 'lucide-react';

export default function SousChefLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <div className="absolute inset-0 h-8 w-8 animate-pulse rounded-full bg-blue-500/10" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Chargement en cours...
        </p>
      </div>
    </div>
  );
}
