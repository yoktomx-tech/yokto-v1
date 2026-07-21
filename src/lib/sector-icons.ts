import { Truck, HardHat, Globe, Home, Car, Briefcase, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SECTOR_ICONS: Record<string, LucideIcon> = {
  AUTOTRANSPORTE: Truck,
  CONSTRUCCION: HardHat,
  COMERCIO_EXTERIOR: Globe,
  INMOBILIARIO: Home,
  VEHICULOS: Car,
  SERVICIOS: Briefcase,
  BIENES: Package,
};

export function getSectorIcon(sector: string | null | undefined): LucideIcon {
  return SECTOR_ICONS[sector ?? ""] ?? Briefcase;
}
