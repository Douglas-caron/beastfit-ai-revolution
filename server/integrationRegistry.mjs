const providers = [
  ['OpenMeteo', 'clima', 'https://api.open-meteo.com/v1/forecast'],
  ['OpenMeteo Air', 'qualidade_do_ar', 'https://air-quality-api.open-meteo.com/v1/air-quality'],
  ['OpenMeteo Geo', 'geocoding', 'https://geocoding-api.open-meteo.com/v1/search'],
  ['OpenMeteo Elevation', 'altitude', 'https://elevation-api.open-meteo.com/v1/elevation'],
  ['OpenMeteo Archive', 'historico_clima', 'https://archive-api.open-meteo.com/v1/archive'],
  ['Wger', 'exercicios', 'https://wger.de/api/v2/exercise/'],
  ['Wger', 'musculos', 'https://wger.de/api/v2/muscle/'],
  ['Wger', 'equipamentos', 'https://wger.de/api/v2/equipment/'],
  ['Wger', 'categorias', 'https://wger.de/api/v2/exercisecategory/'],
  ['OpenFoodFacts', 'nutricao', 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=protein&search_simple=1&json=1'],
  ['OpenFoodFacts', 'produto', 'https://world.openfoodfacts.org/api/v2/product/737628064502.json'],
  ['TheMealDB', 'refeicoes', 'https://www.themealdb.com/api/json/v1/1/search.php?s=chicken'],
  ['Fruityvice', 'alimentos', 'https://www.fruityvice.com/api/fruit/all'],
  ['NagerDate', 'feriados', 'https://date.nager.at/api/v3/PublicHolidays/2026/BR'],
  ['WorldTimeAPI', 'tempo', 'https://worldtimeapi.org/api/timezone/America/Sao_Paulo'],
  ['RestCountries', 'localizacao', 'https://restcountries.com/v3.1/name/brazil'],
  ['Zippopotam', 'cep_demo', 'https://api.zippopotam.us/br/01000-000'],
  ['Nominatim', 'mapas', 'https://nominatim.openstreetmap.org/search?q=academia&format=json'],
  ['Wikipedia', 'conteudo', 'https://pt.wikipedia.org/api/rest_v1/page/summary/Musculacao'],
  ['Wikidata', 'conhecimento', 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=fitness&language=pt&format=json'],
  ['OpenLibrary', 'referencias', 'https://openlibrary.org/search.json?q=exercise+science'],
  ['GitHub', 'codigo_publico', 'https://api.github.com/search/repositories?q=fitness+react'],
  ['PublicAPIs', 'catalogo_publico', 'https://api.publicapis.org/entries'],
  ['RandomUser', 'dados_demo', 'https://randomuser.me/api/?nat=br'],
  ['BoredAPI', 'bem_estar', 'https://www.boredapi.com/api/activity?type=recreational']
];

const purposes = [
  'sincronizacao', 'normalizacao', 'validacao', 'enriquecimento'
];

export const integrations = Array.from({ length: 100 }, (_, index) => {
  const [provider, category, endpoint] = providers[index % providers.length];
  const purpose = purposes[Math.floor(index / providers.length) % purposes.length];
  const id = index + 1;
  return {
    id,
    name: `${provider} ${purpose} ${String(id).padStart(3, '0')}`,
    category,
    provider,
    endpoint,
    method: 'GET',
    free_tier: 'gratuito_publico_ou_demo_com_fallback_local',
    auth_type: provider === 'GitHub' ? 'none_or_token_optional' : 'none',
    status: 'ready_with_safe_fallback',
    mock_response: {
      provider,
      purpose,
      ok: true,
      sample: [
        { metric: 'readiness', value: 82 + (index % 11) },
        { metric: 'riskReduction', value: 14 + (index % 7) }
      ]
    }
  };
});

export function integrationById(id) {
  return integrations.find((item) => item.id === Number(id));
}
