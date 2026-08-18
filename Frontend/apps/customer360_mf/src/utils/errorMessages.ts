// ---------------------------------------------------------------------------
// Error classification / user-facing messages.
//
// Backend and CRM error responses carry technical detail (raw validation
// text, "Bad Request.", CRM implementation strings) that must never reach
// the end user directly in a banking application — it's confusing at best
// and an information-disclosure risk at worst. This module maps a caught
// error (which carries an HTTP status via services/api.ts) to one of a
// fixed set of user-friendly categories, optionally specialized per search
// context (e.g. which field the user was filling in).
//
// This never fabricates or changes the underlying data/error — it only
// controls what text is shown to the user for a given failure category.
// ---------------------------------------------------------------------------

export type ErrorContext = 'individual-search' | 'corporate-search' | 'generic';

/** Anything callers actually pass: a real thrown ApiError/Error, or a plain
 * `{ message, status? }` shape built from a store's `error`/`errorStatus`
 * fields (see Customer360.tsx's product/interaction error branches). */
export interface ClassifiableError {
  message?: string;
  status?: number;
}

/**
 * @param err - the caught error (ideally with a `.status` property set by
 *   services/api.ts's request())
 * @param context - which field/flow the error occurred in, so the
 *   "invalid input" case can name the specific field
 * @param idTypeLabel - human label of the ID type being searched
 *   (e.g. "NRIC number", "BRN") — used to specialize the not-found
 *   and validation messages when known
 */
export function getFriendlyErrorMessage(
  err: ClassifiableError | null | undefined,
  context: ErrorContext = 'generic',
  idTypeLabel = ''
): string {
  const status = err?.status;
  const rawMessage = err?.message || '';

  // No HTTP status at all means fetch() itself rejected — a real network
  // failure (offline, DNS, connection refused), not a server response.
  if (status === undefined) {
    return 'Unable to connect to the customer service. Please check your connection and try again.';
  }

  switch (status) {
    case 400:
      return buildValidationMessage(context, idTypeLabel);
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return "You don't have permission to access this information.";
    case 404:
      return buildNotFoundMessage(context, idTypeLabel);
    case 500:
    case 502:
      return "We're unable to retrieve customer information right now. Please try again.";
    case 503:
      return 'The customer service is temporarily unavailable. Please try again in a moment.';
    case 504:
      return 'The request took too long to complete. Please try again.';
    default: {
      // The frontend's own "no result" check (e.g. customerStore.loadProfileById
      // throwing when the CRM returned an empty data array) doesn't carry an
      // HTTP status — recognize it by its own already-friendly message and
      // pass it through rather than mask it with a generic server error.
      if (/no (customer|company) found/i.test(rawMessage)) {
        return buildNotFoundMessage(context, idTypeLabel);
      }
      return "We're unable to retrieve customer information right now. Please try again.";
    }
  }
}

function buildValidationMessage(context: ErrorContext, idTypeLabel: string): string {
  if (idTypeLabel) {
    return `Please enter a valid ${idTypeLabel}.`;
  }
  if (context === 'corporate-search') {
    return 'Please check the details entered and try again.';
  }
  return 'Please check the details entered and try again.';
}

function buildNotFoundMessage(context: ErrorContext, _idTypeLabel: string): string {
  if (context === 'corporate-search') {
    return 'No company was found with the information provided.';
  }
  return 'No customer was found with the information provided.';
}

// Maps the search-form ID type/label shown to the user to the phrase used in
// "Please enter a valid ___." — kept here (not scattered across
// Customer360.tsx) so the two stay consistent as CRM-supported types change.
export function idTypeToFriendlyLabel(idType: string, subtype?: string): string {
  switch (idType) {
    case 'NRIC':
      return 'NRIC number';
    case 'Phone':
    case 'PHONENO':
      return 'phone number';
    case 'Name':
    case 'FULLNAME':
      return 'full name';
    case 'SecondaryID':
    case 'SECONDARYID':
      switch (subtype) {
        case 'BIRTHCERTIFICATE':
          return 'birth certificate number';
        case 'OLDID':
          return 'Old IC number';
        case 'POLICENUMBER':
          return 'Police ID number';
        case 'PASSPORT':
          return 'passport number';
        default:
          return 'secondary ID';
      }
    case 'BRN':
      return 'Business Registration Number (BRN)';
    case 'OLDBRN':
      return 'Old Business Registration Number';
    case 'COMPANYNAME':
      return 'company name';
    default:
      return '';
  }
}
