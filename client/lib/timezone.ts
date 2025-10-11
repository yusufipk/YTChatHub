/**
 * Timezone utilities for handling browser timezone detection and formatting
 */

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect browser timezone, falling back to UTC:', error);
    return 'UTC';
  }
}

export function formatTimestamp(
  isoString: string, 
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(isoString);
  
  if (!date || isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  };

  const targetTimezone = timezone || getBrowserTimezone();
  
  // If no valid timezone, fall back to local time
  if (!targetTimezone || targetTimezone === '') {
    console.warn('No valid timezone provided, using local time');
    return date.toLocaleTimeString('en-US', defaultOptions);
  }

  try {
    const result = new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: targetTimezone
    }).format(date);
    
    return result;
  } catch (error) {
    console.warn('Failed to format timestamp with timezone, falling back to local:', error);
    
    // Try GMT+3 as a fallback if the detected timezone fails
    try {
      const gmt3Result = new Intl.DateTimeFormat('en-US', {
        ...defaultOptions,
        timeZone: 'Europe/Istanbul' // GMT+3
      }).format(date);
      return gmt3Result;
    } catch (gmt3Error) {
      console.warn('GMT+3 fallback also failed:', gmt3Error);
      return date.toLocaleTimeString('en-US', defaultOptions);
    }
  }
}

export function formatTimestampWithDate(
  isoString: string,
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(isoString);
  
  if (!date || isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  };

  const targetTimezone = timezone || getBrowserTimezone();

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: targetTimezone
    }).format(date);
  } catch (error) {
    console.warn('Failed to format timestamp with timezone, falling back to local:', error);
    return date.toLocaleString('en-US', defaultOptions);
  }
}
