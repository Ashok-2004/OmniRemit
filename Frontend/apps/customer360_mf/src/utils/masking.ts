/**
 * Dynamically masks a phone number in the format +60 1** ***** 567 or similar
 */
export function maskPhone(val: string | null | undefined): string {
  if (!val) return '-';
  const clean = val.trim();
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '-';
  
  if (clean.startsWith('+60 1') || clean.startsWith('+601')) {
    // Determine the offset for the prefix "+60 1" or "+601"
    const prefixLen = clean.startsWith('+60 1') ? 5 : 4;
    const prefix = clean.substring(0, prefixLen);
    const suffix = clean.substring(prefixLen);
    
    if (suffix.length >= 5) {
      const last3 = suffix.substring(suffix.length - 3);
      const middleCount = suffix.length - 3;
      
      // Construct dynamic mask matching the screenshot "+60 1** ***** 567"
      // If middleCount is 5, we do "**" then "***"
      const stars1 = '**';
      const stars2 = '*'.repeat(Math.max(1, middleCount - 2));
      return `${prefix}${stars1} ${stars2} ${last3}`;
    }
  }
  
  // Fallback for other formats: keep first 5 characters and last 3 characters, mask middle
  if (clean.length > 8) {
    const first = clean.substring(0, 5);
    const last = clean.substring(clean.length - 3);
    const stars = '*'.repeat(clean.length - 8);
    return `${first}${stars}${last}`;
  }
  
  return clean;
}

/**
 * Dynamically masks NRIC / Primary ID Number in the format 9*********5421
 */
export function maskNRIC(val: string | null | undefined): string {
  if (!val) return '-';
  const clean = val.trim().replace(/-/g, '');
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '-';
  
  if (clean.length > 5) {
    const first = clean.substring(0, 1);
    const last = clean.substring(clean.length - 4);
    const stars = '*'.repeat(clean.length - 5);
    return `${first}${stars}${last}`;
  }
  return clean;
}

/**
 * Dynamically masks Passport Number in the format E********89
 */
export function maskPassport(val: string | null | undefined): string {
  if (!val) return '-';
  const clean = val.trim();
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '-';
  
  if (clean.length > 3) {
    const first = clean.substring(0, 1);
    const last = clean.substring(clean.length - 2);
    const stars = '*'.repeat(clean.length - 3);
    return `${first}${stars}${last}`;
  }
  return clean;
}

/**
 * Dynamically masks Secondary ID Number (e.g. Old ID) in the format 1****6
 */
export function maskSecondaryID(val: string | null | undefined): string {
  if (!val) return '-';
  const clean = val.trim();
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '-';
  
  if (clean.length > 2) {
    const first = clean.substring(0, 1);
    const last = clean.substring(clean.length - 1);
    const stars = '*'.repeat(clean.length - 2);
    return `${first}${stars}${last}`;
  }
  return clean;
}

/**
 * Dynamically masks Tax Identification Number (TIN) / Income Tax Number in the format T*********12
 */
export function maskTIN(val: string | null | undefined): string {
  if (!val) return '-';
  const clean = val.trim();
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') return '-';
  
  if (clean.length > 3) {
    const first = clean.substring(0, 1);
    const last = clean.substring(clean.length - 2);
    const stars = '*'.repeat(clean.length - 3);
    return `${first}${stars}${last}`;
  }
  return clean;
}
