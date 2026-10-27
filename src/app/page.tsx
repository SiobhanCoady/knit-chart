import { KnitChartApp } from "@/components/knit-chart-app";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="size-6 text-primary" aria-hidden>
              <path
                fill="currentColor"
                d="M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z"
                opacity=".35"
              />
              <path fill="currentColor" d="M10 10h4v4h-4zM3 3h4v4H3zM17 17h4v4h-4z" />
            </svg>
            <span className="font-semibold tracking-tight">knit-chart</span>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">Colourwork charts from a picture or from scratch</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <KnitChartApp />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Images never leave your device. Charts read from the bottom right, row 1 first.
      </footer>
    </div>
  );
}
