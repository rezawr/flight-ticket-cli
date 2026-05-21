export function buildTiketRouteUrl(from: string, to: string, date: string, adults: number): string {
  return `https://www.tiket.com/id-id/flights/search?d=${from.toUpperCase()}&a=${to.toUpperCase()}&date=${date}&adult=${adults}&child=0&infant=0&class=economy&dType=AIRPORT&aType=AIRPORT&type=depart&flexiFare=true`;
}

export function buildTravelokaRouteUrl(from: string, to: string, date: string, adults: number): string {
  return `https://www.traveloka.com/en-id/flight/fullsearch?ap=${from.toUpperCase()}.${to.toUpperCase()}&dt=${date}.NA&ps=${adults}.0.0&sc=ECONOMY`;
}

export function buildAgodaRouteUrl(from: string, to: string, date: string, adults: number): string {
  const departDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(departDate.getTime())) {
    throw new Error(`invalid --date "${date}"; expected YYYY-MM-DD`);
  }
  const returnDate = new Date(departDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return `https://www.agoda.com/flights/results?departureFrom=${from.toUpperCase()}&departureFromType=1&arrivalTo=${to.toUpperCase()}&arrivalToType=1&departDate=${date}&returnDate=${returnDate}&searchType=1&cabinType=Economy&adults=${adults}&sort=8`;
}
