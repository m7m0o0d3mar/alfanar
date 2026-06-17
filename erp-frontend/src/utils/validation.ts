export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationRules = Record<string, {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: string) => string | null;
}>;

export function validate(values: Record<string, string>, rules: ValidationRules): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = values[field] ?? '';
    if (fieldRules.required && !value.trim()) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (!value.trim()) continue;
    if (fieldRules.minLength && value.trim().length < fieldRules.minLength) {
      errors.push({ field, message: `${field} must be at least ${fieldRules.minLength} characters` });
    }
    if (fieldRules.maxLength && value.trim().length > fieldRules.maxLength) {
      errors.push({ field, message: `${field} must not exceed ${fieldRules.maxLength} characters` });
    }
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors.push({ field, message: fieldRules.patternMessage || `${field} has an invalid format` });
    }
    if (fieldRules.custom) {
      const customError = fieldRules.custom(value);
      if (customError) errors.push({ field, message: customError });
    }
  }
  return errors;
}

export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find(e => e.field === field)?.message;
}
