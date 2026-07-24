import darkAsset from "@/assets/cumplex-wordmark-dark.png.asset.json";
import whiteAsset from "@/assets/cumplex-wordmark-white.png.asset.json";
import iconDarkAsset from "@/assets/cumplex-icon-dark.png.asset.json";
import iconWhiteAsset from "@/assets/cumplex-icon-white.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "dark" | "white" | "auto" | "icon";
  className?: string;
  alt?: string;
};

/**
 * Cumplex wordmark. Use variant="dark" on light backgrounds and
 * variant="white" on dark backgrounds. "auto" swaps via the `dark` class.
 * Use variant="icon" for compact/collapsed contexts (auto light/dark).
 */
export function CumplexLogo({ variant = "dark", className, alt = "Cumplex" }: Props) {
  if (variant === "icon") {
    return (
      <>
        <img
          src={iconDarkAsset.url}
          alt={alt}
          className={cn("block dark:hidden select-none", className)}
          draggable={false}
        />
        <img
          src={iconWhiteAsset.url}
          alt=""
          aria-hidden
          className={cn("hidden dark:block select-none", className)}
          draggable={false}
        />
      </>
    );
  }
  if (variant === "auto") {
    return (
      <>
        <img
          src={darkAsset.url}
          alt={alt}
          className={cn("block dark:hidden select-none", className)}
          draggable={false}
        />
        <img
          src={whiteAsset.url}
          alt=""
          aria-hidden
          className={cn("hidden dark:block select-none", className)}
          draggable={false}
        />
      </>
    );
  }
  const src = variant === "white" ? whiteAsset.url : darkAsset.url;
  return (
    <img
      src={src}
      alt={alt}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

