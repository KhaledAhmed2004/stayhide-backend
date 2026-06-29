import type { Reporter, File } from 'vitest';
import chalk from 'chalk';
import figlet from 'figlet';

// Helper to recursively collect all tests from nested suites
function collectTests(tasks: any[]): any[] {
  const tests: any[] = [];
  for (const task of tasks) {
    if (task.type === 'test') {
      tests.push(task);
    } else if (task.type === 'suite' && task.tasks) {
      tests.push(...collectTests(task.tasks));
    }
  }
  return tests;
}

export default class PremiumReporter implements Reporter {
  onInit() {
    console.clear();
    const banner = figlet.textSync('EDUCOIN', {
      font: 'Slant',
      horizontalLayout: 'default',
    });
    console.log(chalk.bold.cyan(banner));
    console.log(chalk.blue('⚡⚡ SYSTEM TEST SUITE RUNNER ⚡⚡'));
    console.log(chalk.gray('=================================================='));
    console.log(chalk.bold.yellow('🚀 Initiating testing pipeline...\n'));
  }

  onFinished(files: File[]) {
    console.log('\n' + chalk.gray('=================================================='));
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const file of files) {
      if (!file.tasks) continue;
      
      const allTests = collectTests(file.tasks);
      for (const test of allTests) {
        totalTests++;
        if (test.result?.state === 'pass') {
          passedTests++;
        } else if (test.result?.state === 'fail') {
          failedTests++;
        }
      }
    }

    if (failedTests > 0) {
      const failBanner = figlet.textSync('FAILED', { font: 'Mini' });
      console.log(chalk.bold.red(failBanner));
      console.log(
        chalk.red.bold(`❌ TESTS FAILED: `) + 
        chalk.red(`${failedTests} failed, `) + 
        chalk.green(`${passedTests} passed `) + 
        chalk.gray(`(Total: ${totalTests})`)
      );
    } else {
      const successBanner = figlet.textSync('PASSED', { font: 'Mini' });
      console.log(chalk.bold.green(successBanner));
      console.log(
        chalk.green.bold(`✨ ALL TESTS PASSED: `) + 
        chalk.green(`${passedTests}/${totalTests} tests successfully completed!`)
      );
    }
    console.log(chalk.gray('==================================================\n'));
  }
}
