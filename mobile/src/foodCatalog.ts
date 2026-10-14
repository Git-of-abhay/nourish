// Approximate single-serving values, used only to prefill an editable estimate.
// The user confirms the portion and calories before saving.
const foods: { terms: string[]; portion: string; kcal: number }[] = [
  { terms: ['rice'], portion: '1 cup cooked', kcal: 205 },
  { terms: ['dal', 'lentil'], portion: '1 cup', kcal: 200 },
  { terms: ['chapati', 'roti'], portion: '1 medium', kcal: 120 },
  { terms: ['banana'], portion: '1 medium', kcal: 105 },
  { terms: ['apple'], portion: '1 medium', kcal: 95 },
  { terms: ['egg'], portion: '1 large', kcal: 72 },
  { terms: ['bread', 'toast'], portion: '1 slice', kcal: 80 },
  { terms: ['idli'], portion: '1 piece', kcal: 60 },
  { terms: ['dosa'], portion: '1 plain', kcal: 170 },
  { terms: ['curd', 'yogurt'], portion: '1 cup', kcal: 150 },
  { terms: ['chicken'], portion: '100 g cooked', kcal: 165 },
  { terms: ['salad'], portion: '1 bowl without dressing', kcal: 80 },
];

export function estimateFromNames(names: string[]): { kcal: number | null; portion: string } {
  const matches = names.map(name => foods.find(food => food.terms.some(term => name.toLowerCase().includes(term))));
  if (!matches.length || matches.some(match => !match)) return { kcal: null, portion: '' };
  return { kcal: matches.reduce((sum, match) => sum + (match?.kcal || 0), 0), portion: matches.map((match, index) => `${names[index]}: ${match?.portion}`).join('; ') };
}

const PLURAL_UNITS = ['cup', 'piece', 'slice', 'bowl'];

function scalePortion(portion: string, quantity: number): string {
  if (quantity === 1) return portion;
  const rest = portion.replace(/^1\s+/, '');
  const [first, ...others] = rest.split(' ');
  const unit = PLURAL_UNITS.includes(first) ? first + 's' : first;
  return [`${Number(quantity.toFixed(2))}`, unit, ...others].join(' ');
}

/** Like estimateFromNames, but multiplies each food by the amount the person said. */
export function estimateFromItems(items: { name: string; quantity: number }[]): { kcal: number | null; portion: string } {
  const matches = items.map(item => ({ item, food: foods.find(food => food.terms.some(term => item.name.toLowerCase().includes(term))) }));
  if (!matches.length || matches.some(match => !match.food)) return { kcal: null, portion: '' };
  return {
    kcal: Math.round(matches.reduce((sum, { item, food }) => sum + (food?.kcal || 0) * item.quantity, 0)),
    portion: matches.map(({ item, food }) => `${item.name}: ${scalePortion(food?.portion || '', item.quantity)}`).join('; '),
  };
}

const CALORIE_FREE = /^(plain |cold |hot |warm |mineral |sparkling |soda |lemon |tap |filtered )?water$|^(black|green|herbal|unsweetened) (coffee|tea)$|^(black )?(coffee|tea) (without|with no) (sugar|milk)$|^(diet|zero)( sugar)? (coke|cola|soda|pepsi)$|^soda water$/i;

/** Only water-like drinks can honestly be 0 kcal. Everything else has energy. */
export function isCalorieFree(name: string): boolean {
  return CALORIE_FREE.test(name.trim().replace(/\s+/g, ' '));
}
