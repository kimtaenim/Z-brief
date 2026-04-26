import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "soft";
  size?: "md" | "lg" | "sm";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition duration-200 ease-apple active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  const variantCls =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-500 shadow-soft"
      : variant === "soft"
      ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200/70"
      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-zinc-900 hover:ring-zinc-300";

  const sizeCls =
    size === "lg"
      ? "rounded-3xl px-6 py-5 text-[16px] sm:text-[17px]"
      : size === "sm"
      ? "rounded-full px-3 py-1.5 text-[12px]"
      : "rounded-2xl px-4 py-2.5 text-[14px]";

  return <button className={cn(base, variantCls, sizeCls, className)} {...rest} />;
}
