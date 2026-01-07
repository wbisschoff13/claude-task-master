/**
 * @fileoverview Task Service Tests
 * Comprehensive unit tests for skip logic and task retrieval functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskService } from './task-service.js';
import { ConfigManager } from '../../config/managers/config-manager.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { Task, TaskStatus } from '../../../common/types/index.js';
import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';

// Mock StorageFactory
vi.mock('../../storage/services/storage-factory.js', () => ({
	StorageFactory: {
		createFromStorageConfig: vi.fn()
	}
}));

describe('TaskService - Skip Logic', () => {
	let service: TaskService;
	let mockConfigManager: ConfigManager;
	let mockStorage: IStorage;

	/**
	 * Creates a mock task with minimal required fields
	 */
	const createMockTask = (overrides?: Partial<Task>): Task => ({
		id: '1',
		title: 'Test Task',
		description: 'Test description',
		details: 'Test details',
		testStrategy: 'Test strategy',
		status: 'pending',
		priority: 'medium',
		dependencies: [],
		subtasks: [],
		tags: [],
		createdAt: '2025-01-08T00:00:00.000Z',
		updatedAt: '2025-01-08T00:00:00.000Z',
		...overrides
	});

	/**
	 * Creates a mock storage implementation
	 */
	const createMockStorage = (tasks: Task[] = []): IStorage => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		loadTasks: vi.fn().mockResolvedValue(tasks),
		loadTask: vi.fn().mockResolvedValue(tasks[0] ?? null),
		saveTasks: vi.fn().mockResolvedValue(undefined),
		appendTasks: vi.fn().mockResolvedValue(undefined),
		updateTask: vi.fn().mockResolvedValue(undefined),
		updateTaskWithPrompt: vi.fn().mockResolvedValue(undefined),
		updateTaskStatus: vi.fn().mockResolvedValue({
			success: true,
			oldStatus: 'pending' as TaskStatus,
			newStatus: 'in-progress' as TaskStatus,
			taskId: '1'
		}),
		expandTaskWithPrompt: vi.fn().mockResolvedValue(undefined),
		deleteTask: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn().mockResolvedValue(true),
		loadMetadata: vi.fn().mockResolvedValue(null),
		saveMetadata: vi.fn().mockResolvedValue(undefined),
		getAllTags: vi.fn().mockResolvedValue([]),
		createTag: vi.fn().mockResolvedValue(undefined),
		deleteTag: vi.fn().mockResolvedValue(undefined),
		renameTag: vi.fn().mockResolvedValue(undefined),
		copyTag: vi.fn().mockResolvedValue(undefined),
		getStats: vi.fn().mockResolvedValue({
			totalTasks: tasks.length,
			totalTags: 1,
			storageSize: 1024,
			lastModified: new Date().toISOString(),
			tagStats: []
		}),
		getTagsWithStats: vi.fn().mockResolvedValue({
			tags: [],
			currentTag: 'master',
			totalTags: 1
		}),
		watch: vi.fn().mockResolvedValue({
			unsubscribe: vi.fn()
		}),
		close: vi.fn().mockResolvedValue(undefined),
		getStorageType: vi.fn().mockReturnValue('file'),
		getCurrentBriefName: vi.fn().mockReturnValue(null)
	});

	beforeEach(async () => {
		// Create mock config manager
		mockConfigManager = {
			getProjectRoot: vi.fn().mockReturnValue('/test/project'),
			getActiveTag: vi.fn().mockReturnValue('master'),
			getStorageConfig: vi.fn().mockReturnValue({
				type: 'file',
				filePath: '/test/project/tasks.json'
			}),
			setActiveTag: vi.fn().mockResolvedValue(undefined)
		} as unknown as ConfigManager;

		// Create mock storage
		mockStorage = createMockStorage();

		// Create service instance
		service = new TaskService(mockConfigManager);

		// Manually inject storage (bypassing StorageFactory mock)
		(service as any).storage = mockStorage;
		(service as any).initialized = true;
	});

	describe('Basic Skip Indexing', () => {
		it('should return first eligible task with skipCount=0', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' }),
				createMockTask({ id: '3', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 0);

			expect(result?.id).toBe('1');
		});

		it('should return second eligible task with skipCount=1', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' }),
				createMockTask({ id: '3', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 1);

			expect(result?.id).toBe('2');
		});

		it('should return third eligible task with skipCount=2', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' }),
				createMockTask({ id: '3', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 2);

			expect(result?.id).toBe('3');
		});

		it('should return Nth eligible task with skipCount=N-1', async () => {
			const tasks = Array.from({ length: 10 }, (_, i) =>
				createMockTask({
					id: String(i + 1),
					priority: 'medium',
					dependencies: []
				})
			);
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 7);

			expect(result?.id).toBe('8');
		});

		it('should return null when skipCount exceeds eligible tasks', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 5);

			expect(result).toBeNull();
		});
	});

	describe('Boundary Conditions', () => {
		it('should return null when skipCount equals eligible tasks count', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' }),
				createMockTask({ id: '3', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 3);

			expect(result).toBeNull();
		});

		it('should throw TaskMasterError for negative skipCount', async () => {
			const tasks = [createMockTask({ id: '1', priority: 'high' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			await expect(service.getNextTask('master', -1)).rejects.toThrow(
				TaskMasterError
			);
		});

		it('should throw TaskMasterError for non-integer skipCount', async () => {
			const tasks = [createMockTask({ id: '1', priority: 'high' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			await expect(service.getNextTask('master', 1.5)).rejects.toThrow(
				TaskMasterError
			);
		});

		it('should throw TaskMasterError for NaN skipCount', async () => {
			const tasks = [createMockTask({ id: '1', priority: 'high' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			await expect(service.getNextTask('master', NaN)).rejects.toThrow(
				TaskMasterError
			);
		});

		it('should return null when no eligible tasks exist', async () => {
			const tasks = [
				createMockTask({ id: '1', status: 'done' }),
				createMockTask({ id: '2', status: 'cancelled' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 0);

			expect(result).toBeNull();
		});

		it('should return null when skipCount is very large', async () => {
			const tasks = [createMockTask({ id: '1', priority: 'high' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 999999);

			expect(result).toBeNull();
		});
	});

	describe('Priority Sorting with Skip', () => {
		it('should respect priority sorting when applying skip', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'low' }),
				createMockTask({ id: '2', priority: 'critical' }),
				createMockTask({ id: '3', priority: 'high' }),
				createMockTask({ id: '4', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Skip 0 should return critical (id: 2)
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('2');

			// Skip 1 should return high (id: 3)
			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('3');

			// Skip 2 should return medium (id: 4)
			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('4');

			// Skip 3 should return low (id: 1)
			const result3 = await service.getNextTask('master', 3);
			expect(result3?.id).toBe('1');
		});

		it('should handle mixed priority tasks with skip', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'low' }),
				createMockTask({ id: '3', priority: 'high' }),
				createMockTask({ id: '4', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 2);

			// Sorted by priority: 1 (high), 3 (high), 2 (low), 4 (low)
			// Skip 2 returns the third task which is task 2 (low priority)
			expect(result?.id).toBe('2');
		});
	});

	describe('Duplicate Priority Tiebreakers', () => {
		it('should use task ID as tiebreaker for same priority', async () => {
			const tasks = [
				createMockTask({ id: '3', priority: 'medium' }),
				createMockTask({ id: '1', priority: 'medium' }),
				createMockTask({ id: '2', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// All same priority, should sort by ID: 1, 2, 3
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('2');

			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('3');
		});

		it('should use dependency count as tiebreaker before ID', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high', dependencies: [] }),
				createMockTask({ id: '2', priority: 'high', dependencies: [] }),
				createMockTask({ id: '3', priority: 'high', dependencies: ['4'] }),
				createMockTask({ id: '4', status: 'done', priority: 'high' }) // Satisfies task 3's dependency
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Tasks 1 and 2 are eligible (0 deps, high priority)
			// Task 3 is ineligible (depends on 4 which is done, but has 1 dep in array)
			// Actually task 3's dep on 4 is satisfied since 4 is done
			// Sorted by dependency count: 1 (0 deps), 2 (0 deps), 3 (1 dep)
			// Tasks 1 and 2 tie on deps, so sorted by ID: 1, 2, then 3
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('2');

			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('3');
		});
	});

	describe('Dependency Resolution with Skip', () => {
		it('should skip tasks with unsatisfied dependencies', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high', dependencies: [] }),
				createMockTask({ id: '2', priority: 'critical', dependencies: ['1'] }),
				createMockTask({ id: '3', priority: 'medium', dependencies: [] })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Only tasks 1 and 3 are eligible (task 2 depends on 1)
			// Sorted by priority: 1 (high), 3 (medium)
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('3');

			const result2 = await service.getNextTask('master', 2);
			expect(result2).toBeNull();
		});

		it('should include tasks with satisfied dependencies', async () => {
			const tasks = [
				createMockTask({ id: '1', status: 'done', priority: 'high' }),
				createMockTask({ id: '2', priority: 'critical', dependencies: ['1'] }),
				createMockTask({ id: '3', priority: 'medium', dependencies: [] })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Tasks 2 and 3 are eligible (task 1 is done)
			// Sorted by priority: 2 (critical), 3 (medium)
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('2');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('3');
		});
	});

	describe('Subtasks from In-Progress Parents', () => {
		it('should prioritize subtasks from in-progress parent tasks', async () => {
			const tasks = [
				createMockTask({
					id: '1',
					status: 'in-progress',
					priority: 'medium',
					subtasks: [
						{
							id: '1',
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: []
						},
						{
							id: '2',
							parentId: '1',
							title: 'Subtask 1.2',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'medium',
							dependencies: []
						}
					]
				}),
				createMockTask({ id: '2', status: 'pending', priority: 'high' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Should return subtask 1.1 (high priority)
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1.1');

			// Should return subtask 1.2
			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('1.2');

			// Should fall through to top-level task 2
			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('2');
		});

		it('should skip entire parent task hierarchy when it has eligible subtasks', async () => {
			const tasks = [
				createMockTask({
					id: '1',
					status: 'in-progress',
					priority: 'high',
					subtasks: [
						{
							id: '1',
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: []
						},
						{
							id: '2',
							parentId: '1',
							title: 'Subtask 1.2',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'medium',
							dependencies: []
						},
						{
							id: '3',
							parentId: '1',
							title: 'Subtask 1.3',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'low',
							dependencies: []
						}
					]
				}),
				createMockTask({ id: '2', status: 'pending', priority: 'high' }),
				createMockTask({ id: '3', status: 'pending', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Eligible hierarchy: Task 1 (with subtasks 1.1, 1.2, 1.3), Task 2, Task 3
			// skip=0 should return 1.1
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1.1');

			// skip=1 should return 1.2
			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('1.2');

			// skip=2 should return 1.3
			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('1.3');

			// skip=3 should skip ALL of task 1's hierarchy (parent + 3 subtasks)
			// and return task 2
			const result3 = await service.getNextTask('master', 3);
			expect(result3?.id).toBe('2');

			// skip=4 should return task 3
			const result4 = await service.getNextTask('master', 4);
			expect(result4?.id).toBe('3');
		});

		it('should skip subtasks with unsatisfied dependencies', async () => {
			const tasks = [
				createMockTask({
					id: '1',
					status: 'in-progress',
					priority: 'high',
					subtasks: [
						{
							id: '1',
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: []
						},
						{
							id: '2',
							parentId: '1',
							title: 'Subtask 1.2',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: ['1']
						}
					]
				})
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Only subtask 1.1 is eligible (1.2 depends on 1.1 which is not done yet)
			// Task 1 is in-progress so its subtasks are prioritized
			// Eligible subtasks: [1.1]
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1.1');

			// Skip 1 exceeds eligible subtasks (1), remainingSkip = 1 - 1 = 0
			// Task 1 has eligible subtasks, so it's excluded from top-level eligible tasks
			// No other tasks available, so returns null
			const result1 = await service.getNextTask('master', 1);
			expect(result1).toBeNull();
		});

		it('should handle skip across subtasks and top-level tasks', async () => {
			const tasks = [
				createMockTask({
					id: '1',
					status: 'in-progress',
					priority: 'high',
					subtasks: [
						{
							id: '1',
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: []
						},
						{
							id: '2',
							parentId: '1',
							title: 'Subtask 1.2',
							description: 'Test',
							details: 'Test',
							testStrategy: 'Test',
							status: 'pending',
							priority: 'high',
							dependencies: []
						}
					]
				}),
				createMockTask({ id: '2', status: 'pending', priority: 'high' }),
				createMockTask({ id: '3', status: 'pending', priority: 'high' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Eligible subtasks: [1.1 (high), 1.2 (high)]
			// Task 1 is excluded from top-level eligible tasks (has eligible subtasks)
			// Eligible top-level tasks: [2 (high), 3 (high)]
			// So skip applies first to subtasks, then to remaining top-level tasks
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1.1');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('1.2');

			// Skip 2: exceeds subtasks (2), remainingSkip = 2 - 2 = 0
			// Task 1 is excluded (has eligible subtasks), so returns task 2
			const result2 = await service.getNextTask('master', 2);
			expect(result2?.id).toBe('2');

			// Skip 3: remainingSkip = 3 - 2 = 1 for top-level
			const result3 = await service.getNextTask('master', 3);
			expect(result3?.id).toBe('3');
		});
	});

	describe('Backward Compatibility', () => {
		it('should default to skipCount=0 when not provided', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master');

			expect(result?.id).toBe('1');
		});

		it('should work with undefined skipCount', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', undefined);

			expect(result?.id).toBe('1');
		});

		it('should treat skipCount=0 explicitly the same as undefined', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high' }),
				createMockTask({ id: '2', priority: 'medium' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const resultUndefined = await service.getNextTask('master', undefined);
			const resultZero = await service.getNextTask('master', 0);

			expect(resultUndefined?.id).toBe(resultZero?.id);
		});
	});

	describe('Tag Filtering with Skip', () => {
		it('should apply skip to filtered task list by tag', async () => {
			const tasks = [
				createMockTask({ id: '1', priority: 'high', tags: ['frontend'] }),
				createMockTask({ id: '2', priority: 'medium', tags: ['backend'] }),
				createMockTask({ id: '3', priority: 'low', tags: ['frontend'] })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Skip should work within the loaded tasks (tag filtering happens at storage level)
			const result = await service.getNextTask('master', 1);

			// Result depends on which tasks are loaded for the tag
			expect(result).not.toBeNull();
		});
	});

	describe('Status Filtering with Skip', () => {
		it('should only consider pending and in-progress tasks', async () => {
			const tasks = [
				createMockTask({ id: '1', status: 'done', priority: 'critical' }),
				createMockTask({ id: '2', status: 'pending', priority: 'high' }),
				createMockTask({ id: '3', status: 'in-progress', priority: 'medium' }),
				createMockTask({ id: '4', status: 'cancelled', priority: 'low' })
			];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			// Only tasks 2 and 3 are eligible
			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('2');

			const result1 = await service.getNextTask('master', 1);
			expect(result1?.id).toBe('3');

			const result2 = await service.getNextTask('master', 2);
			expect(result2).toBeNull();
		});
	});

	describe('Performance with Large Task Sets', () => {
		it('should handle skip with 1000 tasks efficiently', async () => {
			const tasks = Array.from({ length: 1000 }, (_, i) =>
				createMockTask({
					id: String(i + 1),
					priority: 'medium',
					dependencies: []
				})
			);
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const startTime = Date.now();
			const result = await service.getNextTask('master', 500);
			const endTime = Date.now();

			expect(result?.id).toBe('501');
			expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
		});

		it('should handle skip at boundary of large task set', async () => {
			const tasks = Array.from({ length: 100 }, (_, i) =>
				createMockTask({
					id: String(i + 1),
					priority: i % 4 === 0 ? 'high' : 'medium',
					dependencies: []
				})
			);
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result = await service.getNextTask('master', 99);
			expect(result).not.toBeNull();
		});
	});

	describe('Error Handling', () => {
		it('should throw TaskMasterError with correct error code for invalid skipCount', async () => {
			const tasks = [createMockTask({ id: '1' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			await expect(service.getNextTask('master', -1)).rejects.toHaveProperty(
				'code',
				ERROR_CODES.VALIDATION_ERROR
			);
		});

		it('should include skipCount value in error details', async () => {
			const tasks = [createMockTask({ id: '1' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			await expect(service.getNextTask('master', -5)).rejects.toHaveProperty(
				'context.provided',
				-5
			);
		});
	});

	describe('Empty and Edge Cases', () => {
		it('should return null when task list is empty', async () => {
			mockStorage.loadTasks = vi.fn().mockResolvedValue([]);

			const result = await service.getNextTask('master', 0);

			expect(result).toBeNull();
		});

		it('should return null with skipCount=0 on empty list', async () => {
			mockStorage.loadTasks = vi.fn().mockResolvedValue([]);

			const result = await service.getNextTask('master', 0);

			expect(result).toBeNull();
		});

		it('should handle single task with various skip values', async () => {
			const tasks = [createMockTask({ id: '1', priority: 'high' })];
			mockStorage.loadTasks = vi.fn().mockResolvedValue(tasks);

			const result0 = await service.getNextTask('master', 0);
			expect(result0?.id).toBe('1');

			const result1 = await service.getNextTask('master', 1);
			expect(result1).toBeNull();
		});
	});
});
