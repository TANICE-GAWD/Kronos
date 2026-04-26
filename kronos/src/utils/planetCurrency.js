

export const PLANET_CURRENCIES = {
  Mercury: 'ME',
  Venus: 'VE',
  Earth: 'EA',
  Mars: 'MA',
  Jupiter: 'JU',
  Saturn: 'SA',
  Uranus: 'UR',
  Neptune: 'NE',
  BlackHole: 'BH', 
};

export function getCurrencyIdForPlanet(planetName) {
  return PLANET_CURRENCIES[planetName] || 'CREDIT';
}

export function formatCurrencyDisplay(planet) {
  const currencyId = getCurrencyIdForPlanet(planet);
  return `${currencyId}`;
}
