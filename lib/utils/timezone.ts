// Fuso padrão do projeto (mesmo default de `offers.timezone`) — usado sempre
// que não há uma oferta específica selecionada, já que a usuária e a
// esmagadora maioria do público dela estão no Brasil.
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// Trata os campos UTC do Date devolvido como se fossem o "relógio de
// parede" do fuso informado — truque padrão pra fazer aritmética de data
// (início do dia/mês) num fuso diferente do fuso do processo (Vercel roda
// em UTC), sem depender de nenhuma lib externa de datas.
function wallClockAsUtc(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  return new Date(
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    ),
  );
}

export function startOfDayInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  const wall = wallClockAsUtc(date, timeZone);
  const offsetMs = wall.getTime() - date.getTime();
  const midnightWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  return new Date(midnightWall - offsetMs);
}

export function endOfDayInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  return new Date(startOfDayInTimezone(date, timeZone).getTime() + 86_400_000 - 1);
}

export function startOfMonthInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  const wall = wallClockAsUtc(date, timeZone);
  const offsetMs = wall.getTime() - date.getTime();
  const firstOfMonthWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1);
  return new Date(firstOfMonthWall - offsetMs);
}
