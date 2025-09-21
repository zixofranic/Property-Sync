// Utility functions to transform API responses for compatibility with frontend

export function parseJSONField<T>(value: string | T[] | null | undefined, defaultValue: T[] = []): T[] {
  if (!value) return defaultValue;
  if (Array.isArray(value)) return value; // Already parsed

  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.warn('Failed to parse JSON field:', value, error);
    return defaultValue;
  }
}

export function transformProperty(property: any) {
  return {
    ...property,
    imageUrls: parseJSONField<string>(property.imageUrls, []),
  };
}

export function transformTimeline(timeline: any) {
  return {
    ...timeline,
    properties: timeline.properties?.map(transformProperty) || [],
  };
}