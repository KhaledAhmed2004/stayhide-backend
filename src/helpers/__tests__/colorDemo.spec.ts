import { describe, it } from 'vitest';
import chalk from 'chalk';

describe('Colorful Console Log Demo', () => {
  it('prints logs in different vibrant colors', () => {
    console.log('\n');
    console.log(chalk.bold.green('🟢 SUCCESS: ') + chalk.green('Database connection established successfully.'));
    console.log(chalk.bold.yellow('🟡 WARNING: ') + chalk.yellow('Memory usage is slightly high (78%).'));
    console.log(chalk.bold.red('🔴 ERROR:   ') + chalk.red('Failed to fetch resource from API.'));
    console.log(chalk.bold.cyan('🔵 INFO:    ') + chalk.cyan('Server started on port 5002.'));
    console.log(chalk.bold.magenta('🟣 DEBUG:   ') + chalk.magenta('Payload received: { id: 100, active: true }\n'));
    
    // Multi-color styles
    console.log(
      chalk.bgBlue.white.bold(' PREMIUM ') + 
      chalk.blue(' Custom styled console logs are extremely clean!\n')
    );
  });
});
