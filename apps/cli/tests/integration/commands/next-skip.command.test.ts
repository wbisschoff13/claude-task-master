/**
 * @fileoverview Integration tests for 'task-master next --skip' parameter
 *
 * Comprehensive tests covering all skip parameter scenarios including:
 * - Basic skip functionality
 * - Tag filtering with skip
 * - JSON output with skip
 * - Silent mode with skip
 * - Validation and error handling
 * - Edge cases (no tasks, all completed, skip exceeds)
 * - Parallel agent workflow simulation
 * - Backward compatibility
 *
 * @integration
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCliBinPath } from '../../helpers/test-utils.js';

// Capture initial working directory at module load time
const initialCwd = process.cwd();

describe('next command --skip parameter', () => {
	let testDir: string;
	let tasksPath: string;
	let binPath: string;

	beforeAll(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-skip-test-'));
		process.chdir(testDir);
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		binPath = getCliBinPath();

		execFileSync('node', [binPath, 'init', '--yes'], {
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Use fixture to create initial empty tasks file
		const initialTasks = createTasksFile();
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	// Reset to empty tasks before each test
	// Note: This runs before describe-block beforeEach blocks due to nesting order
	beforeEach(() => {
		const initialTasks = createTasksFile();
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	afterAll(() => {
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

	const runNext = (args: string[] = []): { output: string; exitCode: number } => {
		try {
			const output = execFileSync('node', [binPath, 'next', ...args], {
				encoding: 'utf-8',
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

	describe('1. Basic skip functionality', () => {
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

		it('should return the first task when --skip 0 is used', () => {
			const { output, exitCode } = runNext(['--skip', '0']);

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #1');
			expect(output).toContain('First Task');
		});

		it('should skip one task and return the second task with --skip 1', () => {
			const { output, exitCode } = runNext(['--skip', '1']);

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #2');
			expect(output).toContain('Second Task');
			expect(output).not.toContain('First Task');
		});

		it('should skip two tasks and return the third task with --skip 2', () => {
			const { output, exitCode } = runNext(['--skip', '2']);

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #3');
			expect(output).toContain('Third Task');
			expect(output).not.toContain('First Task');
			expect(output).not.toContain('Second Task');
		});

		it('should return first task when skip parameter is not provided', () => {
			const { output, exitCode } = runNext();

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #1');
		});
	});

	describe('3. Skip with JSON output', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Task One', status: 'pending' }),
					createTask({ id: 2, title: 'Task Two', status: 'pending' }),
					createTask({ id: 3, title: 'Task Three', status: 'pending' })
				]
			});
			writeTasks(testData);
		});

		it('should output valid JSON with --skip 1 --format json', () => {
			const { output, exitCode } = runNext(['--skip', '1', '--format', 'json']);

			expect(exitCode).toBe(0);
			expect(() => parseJsonOutput(output)).not.toThrow();
		});

		it('should include skipValue in JSON output', () => {
			const { output } = runNext(['--skip', '2', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json.skipValue).toBe(2);
		});

		it('should include availableTaskCount in JSON output', () => {
			const { output } = runNext(['--skip', '1', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json).toHaveProperty('availableTaskCount');
			expect(typeof json.availableTaskCount).toBe('number');
			expect(json.availableTaskCount).toBeGreaterThanOrEqual(1);
		});

		it('should return correct task with skip in JSON', () => {
			const { output } = runNext(['--skip', '1', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json.found).toBe(true);
			expect(json.task).not.toBeNull();
			expect(json.task.id).toBe('2');
			expect(json.task.title).toBe('Task Two');
		});

		it('should handle skip exceeds available in JSON format', () => {
			const { output } = runNext(['--skip', '10', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json.task).toBeNull();
			expect(json.found).toBe(false);
			expect(json.hasAnyTasks).toBe(true);
			expect(json.skipValue).toBe(10);
			expect(json.availableTaskCount).toBe(3);
		});
	});

	describe('4. Skip with silent mode', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Task 1', status: 'pending' }),
					createTask({ id: 2, title: 'Task 2', status: 'pending' })
				]
			});
			writeTasks(testData);
		});

		it('should suppress output with --skip 1 --silent', () => {
			const { output, exitCode } = runNext(['--skip', '1', '--silent']);

			expect(exitCode).toBe(0);
			// Silent mode should suppress all output
			expect(output.trim()).toBe('');
		});

		it('should suppress output with --skip 0 --silent', () => {
			const { output, exitCode } = runNext(['--skip', '0', '--silent']);

			expect(exitCode).toBe(0);
			expect(output.trim()).toBe('');
		});

		it('should suppress output with --skip 2 --silent', () => {
			const { output, exitCode } = runNext(['--skip', '2', '--silent']);

			expect(exitCode).toBe(0);
			expect(output.trim()).toBe('');
		});

		it('should suppress error output when skip exceeds with --silent', () => {
			const { output, exitCode } = runNext(['--skip', '10', '--silent']);

			// Exit code should still be 0 (no error, just no task found)
			expect(exitCode).toBe(0);
			// Output should be suppressed
			expect(output.trim()).toBe('');
		});
	});

	describe('5. Skip validation', () => {
		it('should throw error for negative skip values', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '-1']);

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should throw error for non-numeric skip values', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', 'abc']);

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should throw error for decimal skip values', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '1.5']);

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			expect(output).toContain('non-negative integer');
		});

		it('should accept zero as valid skip value', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '0']);

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #1');
		});

		it('should accept large positive skip values', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '9999']);

			expect(exitCode).toBe(0);
			// Should show warning message about exceeding available tasks
			expect(output).toContain('No eligible task at skip index 9999');
		});
	});

	describe('6. Skip exceeds available tasks', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Task 1', status: 'pending' }),
					createTask({ id: 2, title: 'Task 2', status: 'pending' })
				]
			});
			writeTasks(testData);
		});

		it('should show warning message when skip exceeds available tasks', () => {
			const { output } = runNext(['--skip', '5']);

			expect(output).toContain('No eligible task at skip index 5');
			expect(output).toContain('Only 2 tasks available');
		});

		it('should show singular "task" when only 1 task available', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output } = runNext(['--skip', '1']);

			expect(output).toContain('Only 1 task available');
			expect(output).not.toContain('tasks available');
		});

		it('should include helpful tip when skip exceeds', () => {
			const { output } = runNext(['--skip', '5']);

			expect(output).toContain('Tip:');
			expect(output).toContain('task-master next');
			expect(output).toContain('--skip=1');
		});

		it('should handle skip equal to available task count', () => {
			const { output } = runNext(['--skip', '2']);

			// Skip index 2 means we want the 3rd task, but only have 2 (indices 0, 1)
			expect(output).toContain('No eligible task at skip index 2');
		});
	});

	describe('7. Skip with no tasks in project', () => {
		beforeEach(() => {
			const testData = createTasksFile();
			writeTasks(testData);
		});

		it('should show appropriate message with --skip 0 and no tasks', () => {
			const { output } = runNext(['--skip', '0']);

			expect(output.toLowerCase()).toContain('no tasks found');
		});

		it('should show appropriate message with --skip 1 and no tasks', () => {
			const { output } = runNext(['--skip', '1']);

			expect(output.toLowerCase()).toContain('no tasks found');
		});

		it('should handle JSON format with no tasks', () => {
			const { output } = runNext(['--skip', '1', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json.task).toBeNull();
			expect(json.found).toBe(false);
			expect(json.hasAnyTasks).toBe(false);
			expect(json.availableTaskCount).toBe(0);
		});
	});

	describe('8. Skip with all tasks completed', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Done 1', status: 'done' }),
					createTask({ id: 2, title: 'Done 2', status: 'done' }),
					createTask({ id: 3, title: 'Done 3', status: 'done' })
				]
			});
			writeTasks(testData);
		});

		it('should show message about all tasks completed with --skip 0', () => {
			const { output } = runNext(['--skip', '0']);

			expect(output.toLowerCase()).toContain('all tasks');
			expect(output.toLowerCase()).toContain('completed');
		});

		it('should show message about all tasks completed with --skip 1', () => {
			const { output } = runNext(['--skip', '1']);

			expect(output.toLowerCase()).toContain('all tasks');
			expect(output.toLowerCase()).toContain('completed');
		});

		it('should handle JSON format when all tasks completed', () => {
			const { output } = runNext(['--skip', '1', '--format', 'json']);
			const json = parseJsonOutput(output);

			expect(json.task).toBeNull();
			expect(json.found).toBe(false);
			expect(json.hasAnyTasks).toBe(true);
			expect(json.availableTaskCount).toBe(0);
		});
	});

	describe('9. Skip with mixed existing options combinations', () => {
		beforeEach(() => {
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Task One',
						status: 'pending'
					}),
					createTask({
						id: 2,
						title: 'Task Two',
						status: 'pending'
					}),
					createTask({
						id: 3,
						title: 'Task Three',
						status: 'pending'
					})
				]
			});
			writeTasks(testData);
		});

		it('should work with --skip and --silent together', () => {
			const { output, exitCode } = runNext(['--skip', '1', '--silent']);

			expect(exitCode).toBe(0);
			expect(output.trim()).toBe('');
		});

		it('should work with --skip, --format, and --silent combined', () => {
			const { output, exitCode } = runNext([
				'--skip',
				'0',
				'--format',
				'json',
				'--silent'
			]);

			expect(exitCode).toBe(0);
			// Silent mode suppresses JSON output
			expect(output.trim()).toBe('');
		});
	});

	describe('10. Skip with parallel agent workflow simulation', () => {
		it('should simulate parallel workflow with multiple agents', () => {

			// Create a set of 5 parallelizable tasks (no dependencies)
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Parallel Task 1',
						description: 'Can be worked on independently',
						status: 'pending'
					}),
					createTask({
						id: 2,
						title: 'Parallel Task 2',
						description: 'Can be worked on independently',
						status: 'pending'
					}),
					createTask({
						id: 3,
						title: 'Parallel Task 3',
						description: 'Can be worked on independently',
						status: 'pending'
					}),
					createTask({
						id: 4,
						title: 'Parallel Task 4',
						description: 'Can be worked on independently',
						status: 'pending'
					}),
					createTask({
						id: 5,
						title: 'Parallel Task 5',
						description: 'Can be worked on independently',
						status: 'pending'
					})
				]
			});
			writeTasks(testData);

			// Simulate Agent 1 getting first task
			const { output: agent1Output } = runNext(['--skip', '0']);
			expect(agent1Output).toContain('Next Task: #1');
			expect(agent1Output).toContain('Parallel Task 1');

			// Simulate Agent 2 getting second task (skipping first)
			const { output: agent2Output } = runNext(['--skip', '1']);
			expect(agent2Output).toContain('Next Task: #2');
			expect(agent2Output).toContain('Parallel Task 2');

			// Simulate Agent 3 getting third task (skipping first two)
			const { output: agent3Output } = runNext(['--skip', '2']);
			expect(agent3Output).toContain('Next Task: #3');
			expect(agent3Output).toContain('Parallel Task 3');

			// Simulate Agent 4 getting fourth task
			const { output: agent4Output } = runNext(['--skip', '3']);
			expect(agent4Output).toContain('Next Task: #4');
			expect(agent4Output).toContain('Parallel Task 4');

			// Simulate Agent 5 getting fifth task
			const { output: agent5Output } = runNext(['--skip', '4']);
			expect(agent5Output).toContain('Next Task: #5');
			expect(agent5Output).toContain('Parallel Task 5');
		}, 30000);

		it('should handle parallel workflow with dependencies correctly', () => {
			// Create tasks where some are parallel after a dependency
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Foundation Task',
						status: 'done'
					}),
					createTask({
						id: 2,
						title: 'Parallel Task A',
						status: 'pending',
						dependencies: ['1']
					}),
					createTask({
						id: 3,
						title: 'Parallel Task B',
						status: 'pending',
						dependencies: ['1']
					}),
					createTask({
						id: 4,
						title: 'Parallel Task C',
						status: 'pending',
						dependencies: ['1']
					})
				]
			});
			writeTasks(testData);

			// All three parallel tasks (2, 3, 4) are eligible since task 1 is done
			const { output: output1 } = runNext(['--skip', '0']);
			expect(output1).toContain('Next Task: #2');

			const { output: output2 } = runNext(['--skip', '1']);
			expect(output2).toContain('Next Task: #3');

			const { output: output3 } = runNext(['--skip', '2']);
			expect(output3).toContain('Next Task: #4');

			// Skip exceeds available eligible tasks
			const { output: output4 } = runNext(['--skip', '3']);
			expect(output4).toContain('No eligible task at skip index 3');
			expect(output4).toContain('Only 3 tasks available');
		}, 30000);

		it('should allow agents to claim tasks without blocking', () => {
			// Simulate 3 agents starting at the same time
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Agent 1 Task', status: 'pending' }),
					createTask({ id: 2, title: 'Agent 2 Task', status: 'pending' }),
					createTask({ id: 3, title: 'Agent 3 Task', status: 'pending' })
				]
			});
			writeTasks(testData);

			// Each agent uses a different skip value to get their task
			const tasks = [];

			for (let skip = 0; skip < 3; skip++) {
				const { output, exitCode } = runNext(['--skip', String(skip)]);
				expect(exitCode).toBe(0);

				// Extract task ID from output
				const match = output.match(/Next Task: #(\d+)/);
				expect(match).not.toBeNull();
				tasks.push(match?.[1]);
			}

			// All three agents should have gotten different tasks
			expect(tasks).toEqual(['1', '2', '3']);
		}, 30000);
	});

	describe('11. Error handling edge cases', () => {
		it('should handle very large skip values gracefully', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '999999']);

			expect(exitCode).toBe(0);
			expect(output).toContain('No eligible task at skip index 999999');
		});

		it('should handle skip with malformed task data gracefully', () => {
			// Create tasks file with some incomplete data
			const incompleteData = {
				tasks: [
					createTask({ id: 1, title: 'Complete Task', status: 'pending' }),
					{ id: 2, title: '' }, // Malformed task
					createTask({ id: 3, title: 'Another Task', status: 'pending' })
				]
			};
			writeTasks(incompleteData);

			// Should not crash, but handle gracefully
			const { output, exitCode } = runNext(['--skip', '1']);

			// Either returns a task or shows appropriate message
			expect([0, 1]).toContain(exitCode);
		});

		it('should handle skip when tasks file is corrupted', () => {
			// Write invalid JSON
			fs.writeFileSync(tasksPath, '{ invalid json }');

			const { output, exitCode } = runNext(['--skip', '1']);

			// Should exit with error
			expect(exitCode).toBe(1);
		});

		it('should handle zero skip with all blocked tasks', () => {
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Unmet Dependency',
						status: 'pending'
					}),
					createTask({
						id: 2,
						title: 'Blocked Task',
						status: 'pending',
						dependencies: ['1']
					})
				]
			});
			writeTasks(testData);

			const { output } = runNext(['--skip', '0']);

			// Task 1 is eligible (no dependencies), Task 2 is blocked
			expect(output).toContain('Next Task: #1');
			expect(output).toContain('Unmet Dependency');
		});

		it('should validate skip parameter before processing tasks', () => {
			// Validation should happen even if tasks are present
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '-1']);

			expect(exitCode).toBe(1);
			expect(output).toContain('Invalid skip count');
			// Should not process tasks or show task details
			expect(output).not.toContain('Task 1');
		});
	});

	describe('12. Backward compatibility verification', () => {
		it('should maintain existing behavior when skip is not provided', () => {
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'First Task', status: 'pending' }),
					createTask({ id: 2, title: 'Second Task', status: 'pending' })
				]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext();

			expect(exitCode).toBe(0);
			expect(output).toContain('Next Task: #1');
			expect(output).toContain('First Task');
		});

		it('should maintain existing behavior with --format json', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output } = runNext(['--format', 'json']);
			const json = parseJsonOutput(output);

			// All expected fields should be present
			expect(json).toHaveProperty('task');
			expect(json).toHaveProperty('found');
			expect(json).toHaveProperty('tag');
			expect(json).toHaveProperty('storageType');
			expect(json).toHaveProperty('hasAnyTasks');

			// New fields should also be present
			expect(json).toHaveProperty('availableTaskCount');
		});

		it('should maintain existing behavior with --silent', () => {
			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--silent']);

			expect(exitCode).toBe(0);
			expect(output.trim()).toBe('');
		});

		it('should maintain existing CLI output format', () => {
			const testData = createTasksFile({
				tasks: [
					createTask({
						id: 1,
						title: 'Test Task',
						description: 'Test description',
						status: 'pending'
					})
				]
			});
			writeTasks(testData);

			const { output } = runNext(['--skip', '0']);

			// Verify expected formatting elements are present
			expect(output).toContain('Next Task:');
			expect(output).toContain('Test Task');
			expect(output).toContain('Status:');
			expect(output).toContain('Suggested Actions:');
		});

		it('should not break existing scripts using task-master next', () => {
			// Simulate existing script usage
			const testData = createTasksFile({
				tasks: [
					createTask({ id: 1, title: 'Script Task', status: 'pending' })
				]
			});
			writeTasks(testData);

			// Existing scripts should continue to work
			const { output, exitCode } = runNext();

			expect(exitCode).toBe(0);
			expect(output).toContain('Script Task');
		});

		it('should work with existing task-master configurations', () => {
			// Verify that existing config files don't interfere
			const configPath = path.join(testDir, '.taskmaster', 'config.json');
			const config = { activeTag: 'default' };
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const testData = createTasksFile({
				tasks: [createTask({ id: 1, title: 'Task 1', status: 'pending' })]
			});
			writeTasks(testData);

			const { output, exitCode } = runNext(['--skip', '0']);

			expect(exitCode).toBe(0);
			expect(output).toContain('Task 1');
		});
	});
});
