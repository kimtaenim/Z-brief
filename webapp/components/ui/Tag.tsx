import { cn } from "@/lib/utils";

interface TagProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Tag({ active, className, children, ...rest }: TagProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition duration-150 ease-apple active:scale-[0.97]",
        active
          ? "bg-blue-600 text-white shadow-soft"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900 hover:ring-zinc-300",
        className,
      )}
      aria-pressed={active}
      {...rest}
    >
      {active && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {children}
    </button>
  );
}
