import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * CLI package Vitest configuration
 * Extends root config with CLI-specific settings
 *
 * Integration tests (.test.ts) spawn CLI processes and need more time.
 * Parallel workflow tests require additional time for multiple CLI invocations.
 * Individual slow tests can have specific timeouts if needed.
 */
export default mergeConfig(
	rootConfig,
	defineConfig({
		test: {
			// CLI-specific test patterns
			include: [
				'tests/**/*.test.ts',
				'tests/**/*.spec.ts',
				'src/**/*.test.ts',
				'src/**/*.spec.ts'
			],
			// Integration tests spawn CLI processes - 10s default
			// Slow tests can override with specific timeouts
			testTimeout: 10000,
			hookTimeout: 10000
		}
	})
);
