import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  sizes?: string;
};

/** The supplied wordmark pair, selected by the app's existing dark theme. */
export function BrandLogo({
  className = "",
  decorative = false,
  priority = false,
  sizes = "220px",
}: BrandLogoProps) {
  const alt = decorative ? "" : "Tiny Surprise";

  return (
    <span className={`relative inline-block aspect-[2048/407] ${className}`}>
      <Image
        src="/icons/tiny-surprise-wordmark-light-2048w.png"
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/icons/tiny-surprise-wordmark-dark-2048w.png"
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}

type BrandMarkProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  variant?: "gradient" | "flat";
};

/** The supplied compact mark for app-shell and install surfaces. */
export function BrandMark({
  className = "",
  decorative = false,
  priority = false,
  variant = "gradient",
}: BrandMarkProps) {
  return (
    <Image
      src={`/icons/tiny-surprise-icon-${variant}-1024.png`}
      alt={decorative ? "" : "Tiny Surprise"}
      width={1024}
      height={1024}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
