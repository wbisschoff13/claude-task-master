/**
 * @fileoverview Integration tests for 'task-master next' command
 *
 * Tests the next command which finds the next available task based on dependencies.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCliBinPath } from '../../helpers/test-utils.js';

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('next command', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-next-test-'));
		process.chdir(testDir);
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		binPath = getCliBinPath();

		execSync(`node "${binPath}" init --yes`, {
			stdio: 'pipe',
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Use fixture to create initial empty tasks file
		const initialTasks = createTasksFile();
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	afterEach(() => {
		try {
			// Restore to the original working directory captured at module load
			process.chdir(initialCwd);
		} catch {
			// Fallback to home directory if initial directory no longer exists
			process.chdir(os.homedir());
		}

		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}

		delete process.env.TASKMASTER_SKIP_AUTO_UPDATE;
	});

	const writeTasks = (tasksData: any) => {
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	};

	const runNext = (args = ''): { output: string; exitCode: number } => {
		try {
			const output = execSync(`node "${binPath}" next ${args}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
			});
			return { output, exitCode: 0 };
		} catch (error: any) {
			// For errors, prioritize stderr (where error messages go)
			return {
				output: error.stderr?.toString() || error.stdout?.toString() || '',
				exitCode: error.status || 1
			};
		}
	};

	it('should find first pending task with no dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'First Available Task',
					description: 'No dependencies',
					status: 'pending'
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('First Available Task');
	});

	it('should return task when dependencies are completed', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Prerequisite', status: 'done' }),
				createTask({
					id: 2,
					title: 'Ready Task',
					description: 'Dependencies met',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Ready Task');
	});

	it('should skip tasks with incomplete dependencies', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation Task', status: 'pending' }),
				createTask({
					id: 2,
					title: 'Blocked Task',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({ id: 3, title: 'Independent Task', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		// Should return either task 1 or task 3 (both have no dependencies)
		const hasFoundation = output.includes('Foundation Task');
		const hasIndependent = output.includes('Independent Task');
		expect(hasFoundation || hasIndependent).toBe(true);
		expect(output).not.toContain('Blocked Task');
	});

	it('should handle complex dependency chain', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Level 1', status: 'done' }),
				createTask({
					id: 2,
					title: 'Level 2',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Level 3 - Next',
					description: 'Should be next',
					status: 'pending',
					dependencies: ['1', '2']
				}),
				createTask({
					id: 4,
					title: 'Level 3 - Blocked',
					status: 'pending',
					dependencies: ['3']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Level 3 - Next');
		expect(output).not.toContain('Blocked');
	});

	it('should skip already completed tasks', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Already Done', status: 'done' }),
				createTask({ id: 2, title: 'Also Done', status: 'done' }),
				createTask({ id: 3, title: 'Next Up', status: 'pending' })
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Next Up');
		expect(output).not.toContain('Already Done');
		expect(output).not.toContain('Also Done');
	});

	it('should handle empty task list', () => {
		const testData = createTasksFile();
		writeTasks(testData);

		const { output } = runNext();

		expect(output.toLowerCase()).toContain('no');
	});

	it('should handle all tasks completed', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done 1', status: 'done' }),
				createTask({ id: 2, title: 'Done 2', status: 'done' }),
				createTask({ id: 3, title: 'Done 3', status: 'done' })
			]
		});
		writeTasks(testData);

		const { output } = runNext();

		expect(output.toLowerCase()).toContain('no');
	});

	it('should find first task in linear dependency chain', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Step 1', status: 'done' }),
				createTask({
					id: 2,
					title: 'Step 2',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Step 3',
					status: 'pending',
					dependencies: ['2']
				}),
				createTask({
					id: 4,
					title: 'Step 4',
					status: 'pending',
					dependencies: ['3']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		expect(output).toContain('Step 3');
		expect(output).not.toContain('Step 4');
	});

	it('should find task among multiple ready tasks', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation', status: 'done' }),
				createTask({
					id: 2,
					title: 'Ready Task A',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Ready Task B',
					status: 'pending',
					dependencies: ['1']
				}),
				createTask({
					id: 4,
					title: 'Ready Task C',
					status: 'pending',
					dependencies: ['1']
				})
			]
		});
		writeTasks(testData);

		const { output, exitCode } = runNext();

		expect(exitCode).toBe(0);
		// Should return one of the ready tasks
		const hasReadyA = output.includes('Ready Task A');
		const hasReadyB = output.includes('Ready Task B');
		const hasReadyC = output.includes('Ready Task C');
		expect(hasReadyA || hasReadyB || hasReadyC).toBe(true);
	});

	describe('--skip parameter validation', () => {
		beforeEach(() => {
			// Create a set of pending tasks for skip testing
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Task 1', status: 'pending' }),
					createTask({ id: 2, title: 'Task 2', status: 'pending' }),
					createTask({ id: 3, title: 'Task 3', status: 'pending' })
				]
			});
			writeTasks(testData);
		});

		it('should pass validation for skip=0', () => {
			const { output, exitCode } = runNext('--skip 0');

			expect(exitCode).toBe(0);
			expect(output).toContain('Task');
		});

		it('should pass validation for positive skip values', () => {
			const { output, exitCode } = runNext('--skip 1');

			expect(exitCode).toBe(0);
			expect(output).toContain('Task');
		});

		it('should pass validation when skip parameter is not provided', () => {
			const { output, exitCode } = runNext();

			expect(exitCode).toBe(0);
			expect(output).toContain('Task');
		});

		it('should throw descriptive error for negative skip values', () => {
			const { output, exitCode } = runNext('--skip -1');

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should throw descriptive error for large negative skip values', () => {
			const { output, exitCode } = runNext('--skip -999');

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should throw a descriptive error for non-numeric skip values', () => {
			const { output, exitCode } = runNext('--skip abc');

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should handle decimal skip values', () => {
			const { output, exitCode } = runNext('--skip 1.5');

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});
	});

	describe('--skip parameter functionality', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'First Task', status: 'pending' }),
					createTask({ id: 2, title: 'Second Task', status: 'pending' }),
					createTask({ id: 3, title: 'Third Task', status: 'pending' })
				]
			});
			writeTasks(testData);
		});

		it('should return the first task when no skip is provided', () => {
			const { output } = runNext();
			expect(output).toContain('Next Task: #1');
		});

		it('should skip one task and return the second task', () => {
			const { output } = runNext('--skip 1');
			expect(output).toContain('Next Task: #2');
		});

		it('should skip two tasks and return the third task', () => {
			const { output } = runNext('--skip 2');
			expect(output).toContain('Next Task: #3');
		});
	});

	describe('JSON output with skip parameter', () => {
		const parseJsonOutput = (output: string) => {
			// Extract JSON object from output
			// The JSON starts with '{' and ends with '}'
			// Find the first '{' and matching '}'
			const startIndex = output.indexOf('{');
			if (startIndex === -1) {
				throw new Error('No JSON object found in output');
			}

			// Find the matching closing brace
			let depth = 0;
			let endIndex = -1;
			for (let i = startIndex; i < output.length; i++) {
				if (output[i] === '{') depth++;
				if (output[i] === '}') depth--;
				if (depth === 0) {
					endIndex = i;
					break;
				}
			}

			if (endIndex === -1) {
				throw new Error('Invalid JSON object in output');
			}

			const jsonStr = output.substring(startIndex, endIndex + 1);
			return JSON.parse(jsonStr);
		};

		describe('JSON structure validation', () => {
			beforeEach(() => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Task One', status: 'pending' }),
						createTask({ id: 2, title: 'Task Two', status: 'pending' })
					]
				});
				writeTasks(testData);
			});

			it('should output valid JSON with --format json', () => {
				const { output, exitCode } = runNext('--format json');

				expect(exitCode).toBe(0);
				expect(() => parseJsonOutput(output)).not.toThrow();
			});

			it.each([
				{ description: 'without skip', args: '--format json' },
				{ description: 'with skip', args: '--skip 1 --format json' }
			])('should include all required fields in JSON output $description', ({ args }) => {
				const { output } = runNext(args);
				const json = parseJsonOutput(output);

				expect(json).toHaveProperty('task');
				expect(json).toHaveProperty('found');
				expect(json).toHaveProperty('tag');
				expect(json).toHaveProperty('storageType');
				expect(json).toHaveProperty('hasAnyTasks');
			});

			it('should include skipValue when skip parameter is provided', () => {
				const { output } = runNext('--skip 1 --format json');
				const json = parseJsonOutput(output);

				expect(json).toHaveProperty('skipValue');
				expect(json.skipValue).toBe(1);
			});

			it('should include availableTaskCount in JSON output', () => {
				const { output } = runNext('--format json');
				const json = parseJsonOutput(output);

				expect(json).toHaveProperty('availableTaskCount');
				expect(typeof json.availableTaskCount).toBe('number');
			});
		});

		describe('skip=0 edge case', () => {
			beforeEach(() => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'First Task', status: 'pending' }),
						createTask({ id: 2, title: 'Second Task', status: 'pending' })
					]
				});
				writeTasks(testData);
			});

			it('should return same JSON with --skip 0 as without skip', () => {
				const { output: outputWithSkip } = runNext('--skip 0 --format json');
				const { output: outputWithoutSkip } = runNext('--format json');

				const jsonWithSkip = parseJsonOutput(outputWithSkip);
				const jsonWithoutSkip = parseJsonOutput(outputWithoutSkip);

				// All fields should be identical except skipValue
				expect(jsonWithSkip).toEqual({
					...jsonWithoutSkip,
					skipValue: 0
				});
			});

			it('should include skipValue=0 in JSON output', () => {
				const { output } = runNext('--skip 0 --format json');
				const json = parseJsonOutput(output);

				expect(json.skipValue).toBe(0);
			});
		});

		describe('skip exceeds available tasks', () => {
			beforeEach(() => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Task 1', status: 'pending' }),
						createTask({ id: 2, title: 'Task 2', status: 'pending' })
					]
				});
				writeTasks(testData);
			});

			it('should return task:null and found:false when skip exceeds available tasks', () => {
				const { output } = runNext('--skip 5 --format json');
				const json = parseJsonOutput(output);

				expect(json.task).toBeNull();
				expect(json.found).toBe(false);
				expect(json.hasAnyTasks).toBe(true);
			});

			it('should include skipValue and availableTaskCount when skip exceeds', () => {
				const { output } = runNext('--skip 5 --format json');
				const json = parseJsonOutput(output);

				expect(json.skipValue).toBe(5);
				expect(json.availableTaskCount).toBe(2);
			});

			it('should maintain JSON structure for programmatic consumption', () => {
				const { output } = runNext('--skip 10 --format json');
				const json = parseJsonOutput(output);

				// All fields should be present even when no task is found
				expect(json).toHaveProperty('task');
				expect(json).toHaveProperty('found');
				expect(json).toHaveProperty('tag');
				expect(json).toHaveProperty('storageType');
				expect(json).toHaveProperty('hasAnyTasks');
				expect(json).toHaveProperty('skipValue');
				expect(json).toHaveProperty('availableTaskCount');
			});
		});

		describe('skip with different task states', () => {
			it('should only count eligible tasks (pending, no unmet dependencies)', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Pending Task', status: 'pending' }),
						createTask({ id: 2, title: 'Done Task', status: 'done' }),
						createTask({
							id: 3,
							title: 'Blocked Task',
							status: 'pending',
							dependencies: ['4']
						}),
						createTask({
							id: 4,
							title: 'Unmet Dependency',
							status: 'pending'
						})
					]
				});
				writeTasks(testData);

				// Task 1 and task 4 are eligible (both pending with no unmet dependencies)
				// Task 2 is done (not eligible)
				// Task 3 is blocked by task 4 (not eligible)
				const { output } = runNext('--format json');
				const json = parseJsonOutput(output);

				expect(json.availableTaskCount).toBe(2);
			});

			it('should skip only eligible tasks', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Task 1', status: 'pending' }),
						createTask({ id: 2, title: 'Task 2', status: 'pending' }),
						createTask({ id: 3, title: 'Done Task', status: 'done' })
					]
				});
				writeTasks(testData);

				const { output } = runNext('--skip 1 --format json');
				const json = parseJsonOutput(output);

				// Should skip task 1 and return task 2
				expect(json.task.id).toBe('2');
				expect(json.skipValue).toBe(1);
				expect(json.availableTaskCount).toBe(2);
			});
		});

		describe('JSON compatibility with other options', () => {
			beforeEach(() => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Tagged Task', status: 'pending' }),
						createTask({
							id: 2,
							title: 'Task with Tag',
							status: 'pending',
							tags: ['feature']
						})
					]
				});
				writeTasks(testData);
			});

			it('should work with --format json and --skip together', () => {
				const { output, exitCode } = runNext('--skip 1 --format json');

				expect(exitCode).toBe(0);
				expect(() => parseJsonOutput(output)).not.toThrow();
			});

			it('should work with --silent flag (suppresses JSON output)', () => {
				const { output, exitCode } = runNext('--format json --silent');

				expect(exitCode).toBe(0);
				// --silent suppresses the JSON output, but FYI messages may still be shown
				// Verify that no JSON object is in the output
				expect(output).not.toContain('{');
				expect(output).not.toContain('}');
			});

			it('should work with --tag filter', () => {
				const { output, exitCode } = runNext(
					'--format json --tag feature --skip 0'
				);

				expect(exitCode).toBe(0);
				const json = parseJsonOutput(output);
				expect(json).toHaveProperty('tag');
			});
		});

		describe('backward compatibility', () => {
			it('should return same JSON structure for existing users', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({
							id: 1,
							title: 'Test Task',
							status: 'pending',
							description: 'Test description'
						})
					]
				});
				writeTasks(testData);

				const { output } = runNext('--format json');
				const json = parseJsonOutput(output);

				// Verify expected structure
				expect(json).toMatchObject({
					found: true,
					tag: expect.any(String),
					storageType: expect.any(String),
					hasAnyTasks: true
				});
				expect(json.task).toMatchObject({
					id: '1',
					title: 'Test Task',
					status: 'pending'
				});
			});

			it('should not break JSON output for scripts', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Task 1', status: 'pending' }),
						createTask({ id: 2, title: 'Task 2', status: 'pending' })
					]
				});
				writeTasks(testData);

				// Simulate script usage
				const { output } = runNext('--format json --skip 1');
				const json = parseJsonOutput(output);

				// Script can reliably check these fields
				expect(json.found).toBe(true);
				expect(json.task).not.toBeNull();
				expect(json.task.id).toBe('2');
			});
		});

		describe('edge cases', () => {
			it('should handle no tasks available', () => {
				const testData = createTasksFile();
				writeTasks(testData);

				const { output } = runNext('--format json');
				const json = parseJsonOutput(output);

				expect(json.task).toBeNull();
				expect(json.found).toBe(false);
				expect(json.hasAnyTasks).toBe(false);
			});

			it('should handle all tasks completed', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Done 1', status: 'done' }),
						createTask({ id: 2, title: 'Done 2', status: 'done' })
					]
				});
				writeTasks(testData);

				const { output } = runNext('--format json');
				const json = parseJsonOutput(output);

				expect(json.task).toBeNull();
				expect(json.found).toBe(false);
				expect(json.hasAnyTasks).toBe(true);
				expect(json.availableTaskCount).toBe(0);
			});

			it('should handle large skip values', () => {
				const testData = createTasksFile({
					tasks: [
						createTask({ id: 1, title: 'Task 1', status: 'pending' })
					]
				});
				writeTasks(testData);

				const { output } = runNext('--skip 9999 --format json');
				const json = parseJsonOutput(output);

				expect(json.skipValue).toBe(9999);
				expect(json.task).toBeNull();
				expect(json.found).toBe(false);
			});

			it('should produce readable JSON for large task sets', () => {
				const tasks = Array.from({ length: 100 }, (_, i) =>
					createTask({
						id: i + 1,
						title: `Task ${i + 1}`,
						status: 'pending'
					})
				);

				const testData = createTasksFile({ tasks });
				writeTasks(testData);

				const { output } = runNext('--format json --skip 50');

				// Should be valid JSON
				expect(() => parseJsonOutput(output)).not.toThrow();

				// Should be readable (formatted with 2-space indentation)
				const json = parseJsonOutput(output);
				expect(json.task).not.toBeNull();
				expect(json.skipValue).toBe(50);
			});
		});
	});
});
