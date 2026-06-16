import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
};

export default function BrandLogo({ className, imageClassName }: BrandLogoProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg bg-black border border-[rgba(212,175,55,0.45)] shadow-sm shadow-black/20",
        className,
      )}
    >
      <img
        src="/NF.jpeg"
        alt="Nibir Fashion logo"
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </div>
  );
}
