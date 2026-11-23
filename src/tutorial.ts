export const tourSections=['room','wardrobe','range','shop','gifts','tasks'] as const;
export type TourSection=typeof tourSections[number];

export function isTourSection(value:unknown):value is TourSection{
 return tourSections.some(section=>section===value);
}
