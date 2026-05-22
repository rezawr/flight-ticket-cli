export function buildTiketRouteUrl(from: string, to: string, date: string, adults: number, children: number, infants: number, flightClass: string): string {
  const mapFlightClass: Record<string, string> = {
    economy: "economy",
    premium: "premium_economy",
    business: "business",
    first: "first",
  };
  const cabinType = mapFlightClass[flightClass] || "economy";
  return `https://www.tiket.com/id-id/flights/search?d=${from.toUpperCase()}&a=${to.toUpperCase()}&date=${date}&adult=${adults}&child=${children}&infant=${infants}&class=${cabinType}&dType=AIRPORT&aType=AIRPORT&type=depart&flexiFare=true`;
}

export function buildTravelokaRouteUrl(from: string, to: string, date: string, adults: number, children: number, infants: number, flightClass: string): string {
  const mapFlightClass: Record<string, string> = {
    economy: "ECONOMY",
    premium: "PREMIUM_ECONOMY",
    business: "BUSINESS",
    first: "FIRST",
  };
  const cabinType = mapFlightClass[flightClass] || "ECONOMY";

  return `https://www.traveloka.com/en-id/flight/fullsearch?ap=${from.toUpperCase()}.${to.toUpperCase()}&dt=${date}.NA&ps=${adults}.${children}.${infants}&sc=${cabinType}`;
}

export function buildAgodaRouteUrl(from: string, to: string, date: string, adults: number, children: number, infants: number, flightClass: string): string {
  const mapFlightClass: Record<string, string> = {
    economy: "Economy",
    premium: "PremiumEconomy",
    business: "Business",
    first: "First",
  };
  const cabinType = mapFlightClass[flightClass] || "Economy";
  const departDate = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(departDate.getTime())) {
    throw new Error(`invalid --date "${date}"; expected YYYY-MM-DD`);
  }
  const returnDate = new Date(departDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return `https://www.agoda.com/flights/results?departureFrom=${from.toUpperCase()}&departureFromType=1&arrivalTo=${to.toUpperCase()}&arrivalToType=1&departDate=${date}&returnDate=${returnDate}&searchType=1&cabinType=${cabinType}&adults=${adults}&children=${children}&infants=${infants}&sort=8`;
}
