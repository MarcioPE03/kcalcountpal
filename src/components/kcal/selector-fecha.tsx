import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { fechasConComidasQuery } from "@/lib/data";
import { calendarioDeFecha, fechaDeCalendario } from "@/lib/nutri";

export function SelectorFecha({ fecha, hoy, onChange, children }: { fecha: string; hoy: string; onChange: (f: string) => void; children: React.ReactNode }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState(() => calendarioDeFecha(fecha));
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const desde = fechaDeCalendario(new Date(y, m - 1, 20));
  const hasta = fechaDeCalendario(new Date(y, m + 1, 10));
  const fechas = useQuery({ ...fechasConComidasQuery(desde, hasta), enabled: open });
  const conComidas = (fechas.data ?? []).map(calendarioDeFecha);

  const cal = (
    <Calendar
      mode="single"
      locale={es}
      selected={calendarioDeFecha(fecha)}
      month={mes}
      onMonthChange={setMes}
      today={calendarioDeFecha(hoy)}
      disabled={{ after: calendarioDeFecha(hoy) }}
      endMonth={calendarioDeFecha(hoy)}
      classNames={{ today: "rounded-md font-bold text-primary ring-1 ring-primary/50" }}
      modifiers={{ conComidas }}
      modifiersClassNames={{
        conComidas:
          "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-accent",
      }}
      onSelect={(d) => {
        if (!d) return;
        onChange(fechaDeCalendario(d));
        setOpen(false);
      }}
      className="pointer-events-auto mx-auto p-3"
    />
  );

  const trigger = (
    <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 hover:bg-white/15" aria-label="Elegir fecha">
      {children}
      <CalendarDays className="size-4 opacity-80" />
    </button>
  );

  const onOpen = (o: boolean) => {
    if (o) setMes(calendarioDeFecha(fecha));
    setOpen(o);
  };

  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Elegí un día</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">{cal}</div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">{cal}</PopoverContent>
    </Popover>
  );
}
