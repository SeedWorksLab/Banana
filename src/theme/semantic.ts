import type { SemanticTokens } from './tokens/colors';

export interface SemanticColors {
  readonly success: string;
  readonly successContainer: string;
  readonly onSuccess: string;
  readonly successBorder: string;
  readonly warning: string;
  readonly warningContainer: string;
  readonly onWarning: string;
  readonly warningBorder: string;
  readonly error: string;
  readonly errorContainer: string;
  readonly onError: string;
  readonly errorBorder: string;
  readonly info: string;
  readonly infoContainer: string;
  readonly onInfo: string;
  readonly infoBorder: string;
  readonly saving: string;
  readonly savingContainer: string;
  readonly onSaving: string;
  readonly savingBorder: string;
  readonly pricey: string;
  readonly priceyContainer: string;
  readonly onPricey: string;
  readonly priceyBorder: string;
  readonly delete: string;
  readonly deleteContainer: string;
}

export function buildSemanticColors(
  tokens: SemanticTokens,
  onAccent: string
): SemanticColors {
  return {
    success: tokens.success,
    successContainer: tokens.successLight,
    onSuccess: onAccent,
    successBorder: tokens.successBorder,
    warning: tokens.warning,
    warningContainer: tokens.warningLight,
    onWarning: onAccent,
    warningBorder: tokens.warningBorder,
    error: tokens.error,
    errorContainer: tokens.errorLight,
    onError: onAccent,
    errorBorder: tokens.errorBorder,
    info: tokens.info,
    infoContainer: tokens.infoLight,
    onInfo: onAccent,
    infoBorder: tokens.infoBorder,
    saving: tokens.success,
    savingContainer: tokens.successLight,
    onSaving: onAccent,
    savingBorder: tokens.successBorder,
    pricey: tokens.warning,
    priceyContainer: tokens.warningLight,
    onPricey: onAccent,
    priceyBorder: tokens.warningBorder,
    delete: tokens.error,
    deleteContainer: tokens.errorLight,
  };
}
