const prohibitedListingTerms = /\b(?:phones?|smartphones?|cellphones?|cell\s+phones?|mobile\s+phones?|iphones?|android\s+phones?|laptops?|macbooks?|chromebooks?|notebook\s+computers?)\b/i;

export function isPhoneOrLaptopListing(title: string, description: string) {
  return prohibitedListingTerms.test(`${title} ${description}`);
}

export const prohibitedListingMessage = "Phones and laptops can’t be listed on D_clutr.";
