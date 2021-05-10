import fs from 'fs';

/**
 * @param  {string} file
 * @returns {Promise<boolean>} Whether the file exists
 */
export async function checkFileExists(file: string) {
  return fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}
