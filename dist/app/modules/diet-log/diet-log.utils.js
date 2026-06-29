"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenizeFoodItems = exports.FOOD_STOP_WORDS = void 0;
exports.FOOD_STOP_WORDS = new Set([
    'and', 'with', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'some', 'extra',
    'my', 'ate', 'had', 'for', 'breakfast', 'lunch', 'dinner', 'snack', 'snacks',
    'large', 'small', 'medium', 'bowl', 'plate', 'cup', 'glass', 'piece', 'pieces',
    'slice', 'slices', 'portion', 'portions', 'bit', 'lot', 'too', 'much', 'very',
    'little', 'few', 'many', 'more', 'less', 'about', 'around', 'just', 'only',
    'or', 'but', 'not', 'no', 'yes', 'so', 'then', 'than', 'that', 'this', 'these',
    'those', 'it', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'from', 'by', 'as', 'to', 'into', 'up', 'down', 'out', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'own', 'same', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
    'fried', 'boiled', 'baked', 'roasted', 'grilled', 'steamed', 'raw', 'cooked'
]);
/**
 * Extracts meaningful keywords from a free-text food log string.
 * @param text The raw input string (e.g. "Oatmeal with extra sugar and a banana")
 * @returns Array of unique, meaningful keywords (e.g. ["oatmeal", "sugar", "banana"])
 */
const tokenizeFoodItems = (text) => {
    if (!text)
        return [];
    // Convert to lowercase
    const lower = text.toLowerCase();
    // Replace punctuation and numbers with spaces
    const cleaned = lower.replace(/[^a-z\s]/g, ' ');
    // Split by whitespace
    const words = cleaned.split(/\s+/);
    // Filter out stop words and short words (length < 3)
    const meaningfulWords = words.filter(word => {
        return word.length > 2 && !exports.FOOD_STOP_WORDS.has(word);
    });
    // Return unique words
    return Array.from(new Set(meaningfulWords));
};
exports.tokenizeFoodItems = tokenizeFoodItems;
