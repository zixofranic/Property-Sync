const { execSync } = require('child_process');

try {
  const output = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
  console.log('No errors found!');
} catch (error) {
  const lines = error.stdout.split('\n');
  const fileErrors = {};
  let currentFile = null;

  lines.forEach(line => {
    if (line.match(/^[A-Z]:\\/)) {
      currentFile = line.trim();
      if (!fileErrors[currentFile]) {
        fileErrors[currentFile] = 0;
      }
    } else if (line.match(/^\s+\d+:\d+\s+error/)) {
      if (currentFile) {
        fileErrors[currentFile]++;
      }
    }
  });

  const sorted = Object.entries(fileErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('Top 20 files with most errors:');
  sorted.forEach(([file, count]) => {
    const shortFile = file.split('\\').pop();
    console.log(`${shortFile}: ${count} errors`);
  });
}
