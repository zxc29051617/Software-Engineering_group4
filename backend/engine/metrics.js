/**
 * Measurements of an array's "sortedness".
 * @module engine/metrics
 */

/**
 * Number of pairs (i, j) with i < j and a[i] > a[j], in O(n log n).
 * Bubble sort and insertion sort perform exactly this many swaps.
 * @param {number[]} array
 * @returns {number}
 */
export function countInversions(array) {
  const work = array.slice();
  const buffer = new Array(work.length);
  return countRange(work, buffer, 0, work.length - 1);
}

/**
 * Merge-sorts `a[lo..hi]` in place and returns the inversions inside it.
 * @param {number[]} a
 * @param {number[]} buffer
 * @param {number} lo
 * @param {number} hi
 */
function countRange(a, buffer, lo, hi) {
  if (lo >= hi) return 0;
  const mid = Math.floor((lo + hi) / 2);
  let count = countRange(a, buffer, lo, mid) + countRange(a, buffer, mid + 1, hi);
  let i = lo;
  let j = mid + 1;
  let k = lo;
  while (i <= mid && j <= hi) {
    if (a[j] < a[i]) {
      count += mid - i + 1;
      buffer[k++] = a[j++];
    } else {
      buffer[k++] = a[i++];
    }
  }
  while (i <= mid) buffer[k++] = a[i++];
  while (j <= hi) buffer[k++] = a[j++];
  for (k = lo; k <= hi; k += 1) a[k] = buffer[k];
  return count;
}

/**
 * Maximum possible inversions for `n` elements: n(n-1)/2.
 * @param {number} n
 */
export function maxInversions(n) {
  return n < 2 ? 0 : (n * (n - 1)) / 2;
}

/**
 * True when the array is in non-decreasing order.
 * @param {number[]} array
 */
export function isSorted(array) {
  for (let i = 1; i < array.length; i += 1) {
    if (array[i - 1] > array[i]) return false;
  }
  return true;
}
