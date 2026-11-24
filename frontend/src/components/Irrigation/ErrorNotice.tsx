export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div role="alert" className="rounded-lg border border-ag-risk-critical-border bg-ag-risk-critical-bg p-4 text-sm text-red-900">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-12 items-center rounded-lg border border-red-300 bg-white px-3 font-semibold transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 md:min-h-10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
