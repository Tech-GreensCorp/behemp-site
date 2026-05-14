/**
 * Converte um número para extenso em inglês.
 * Portado do método PHP Invoice_Generator::number_to_words()
 *
 * @param value - Número a ser convertido
 * @returns String do número por extenso em inglês
 */
export function numberToWords(value: number): string {
  const dictionary: Record<number, string> = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
    13: 'thirteen',
    14: 'fourteen',
    15: 'fifteen',
    16: 'sixteen',
    17: 'seventeen',
    18: 'eighteen',
    19: 'nineteen',
    20: 'twenty',
    30: 'thirty',
    40: 'forty',
    50: 'fifty',
    60: 'sixty',
    70: 'seventy',
    80: 'eighty',
    90: 'ninety',
  };

  if (value < 0) {
    return 'negative ' + numberToWords(Math.abs(value));
  }

  if (value < 21) {
    return dictionary[value] ?? 'zero';
  }

  if (value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const units = value % 10;
    return units ? `${dictionary[tens]}-${dictionary[units]}` : dictionary[tens];
  }

  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    const result = `${dictionary[hundreds]} hundred`;
    return remainder ? `${result} and ${numberToWords(remainder)}` : result;
  }

  // thousands, millions, etc.
  const units: [number, string][] = [
    [1_000_000_000_000, 'trillion'],
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];

  for (const [base, label] of units) {
    if (value >= base) {
      const count = Math.floor(value / base);
      const remainder = value % base;
      const result = `${numberToWords(count)} ${label}`;
      if (!remainder) return result;
      return remainder < 100
        ? `${result} and ${numberToWords(remainder)}`
        : `${result}, ${numberToWords(remainder)}`;
    }
  }

  return 'zero';
}

/**
 * Formata um valor monetário em dólares por extenso.
 * Ex: 1250.50 → "One thousand, two hundred and fifty United States Dollars and fifty Cents"
 */
export function formatTotalInWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);

  let words =
    numberToWords(dollars).charAt(0).toUpperCase() +
    numberToWords(dollars).slice(1);

  words += dollars === 1 ? ' United States Dollar' : ' United States Dollars';

  if (cents > 0) {
    words += ' and ' + numberToWords(cents);
    words += cents === 1 ? ' Cent' : ' Cents';
  }

  return words;
}
