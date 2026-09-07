/**
 * Utility functions for consistently sorting Classes and Sections in natural ascending order.
 */

/**
 * Sorts an array of class objects in natural ascending order by class name and then section.
 * Example order:
 *  - Nursery - A
 *  - LKG - A
 *  - UKG - A
 *  - Class 1 - A
 *  - Class 1 - B
 *  - Class 2 - A
 *  - Class 10 - A
 *  - Class 12 - A
 *
 * @param {Array<Object>} classes - Array of class objects ({ name, section, ... })
 * @returns {Array<Object>} Sorted array of classes
 */
export const sortClassesAscending = (classes = []) => {
  if (!Array.isArray(classes)) return [];
  return [...classes].sort((a, b) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    const nameA = (a.name || a.className || a.title || '').toString().trim();
    const nameB = (b.name || b.className || b.title || '').toString().trim();

    const nameCompare = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    if (nameCompare !== 0) return nameCompare;

    const sectionA = (a.section || a.sectionName || '').toString().trim();
    const sectionB = (b.section || b.sectionName || '').toString().trim();

    return sectionA.localeCompare(sectionB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

/**
 * Sorts an array of section strings or section objects in natural ascending order.
 * Example order:
 *  - 'A', 'B', 'C', 'D'
 *
 * @param {Array<string|Object>} sections - Array of section strings or objects with `section` property
 * @returns {Array<string|Object>} Sorted sections
 */
export const sortSectionsAscending = (sections = []) => {
  if (!Array.isArray(sections)) return [];
  return [...sections].sort((a, b) => {
    const secA = (typeof a === 'object' && a !== null ? (a.section || a.name || a.sectionName || '') : (a || '')).toString().trim();
    const secB = (typeof b === 'object' && b !== null ? (b.section || b.name || b.sectionName || '') : (b || '')).toString().trim();
    return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export default sortClassesAscending;
