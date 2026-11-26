export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-white px-4 font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
