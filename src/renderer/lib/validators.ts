// src/renderer/lib/validators.ts — Input validators for property controls

export function isValidUrl(value: string): boolean {
    if (!value) return true;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function isValidEmail(value: string): boolean {
    if (!value) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

export function isValidNumber(value: string): boolean {
    if (!value) return true;
    return !isNaN(Number(value)) && isFinite(Number(value));
}

export function isValidDate(value: string): boolean {
    if (!value) return true;
    const date = new Date(value);
    return !isNaN(date.getTime());
}

export function isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
}

export function isWithinLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength;
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
}

export function validateUrl(value: string): ValidationResult {
    if (!value) return { valid: true };
    if (!isValidUrl(value)) {
        return { valid: false, message: 'Please enter a valid URL' };
    }
    return { valid: true };
}

export function validateEmail(value: string): ValidationResult {
    if (!value) return { valid: true };
    if (!isValidEmail(value)) {
        return { valid: false, message: 'Please enter a valid email address' };
    }
    return { valid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
    if (!isNotEmpty(value)) {
        return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true };
}

export function validateNumber(value: string): ValidationResult {
    if (!value) return { valid: true };
    if (!isValidNumber(value)) {
        return { valid: false, message: 'Please enter a valid number' };
    }
    return { valid: true };
}
