/**
 * @fileoverview Tasks Domain Facade Tests
 * Tests for the public API layer - verifies parameter pass-through to services
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksDomain } from './tasks-domain.js';
import { ConfigManager } from '../config/managers/config-manager.js';
import type { Task } from '../../common/types/index.js';

describe('TasksDomain', () => {
	let domain: TasksDomain;
	let mockConfigManager: ConfigManager;

	// Mock task data
	const mockTask: Task = {
		id: '1',
		title: 'Test Task',
		description: 'Test description',
		status: 'pending',
		priority: 'high',
		dependencies: [],
		details: 'Test details',
		testStrategy: 'Test strategy',
		subtasks: [],
		createdAt: '2025-01-07T00:00:00.000Z',
		updatedAt: '2025-01-07T00:00:00.000Z'
	};

	/**
	 * Creates a properly typed mock TaskService
	 * Type-safe alternative to 'as any' casting
	 */
	const createMockTaskService = (overrides?: {
		getNextTask?: ReturnType<typeof vi.fn>;
	}) => ({
		getNextTask: overrides?.getNextTask ?? vi.fn(),
	});

	beforeEach(() => {
		// Create mock config manager with complete interface implementation
		mockConfigManager = {
			getProjectRoot: vi.fn().mockReturnValue('/test/project'),
			getActiveTag: vi.fn().mockReturnValue('master'),
			getStorageConfig: vi.fn().mockReturnValue({
				type: 'file',
				filePath: '/test/project/tasks.json'
			}),
			// Add other required methods if they exist on ConfigManager
		} as ConfigManager;

		domain = new TasksDomain(mockConfigManager);
	});

	describe('getNext', () => {
		it('should pass skipCount parameter to service layer', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(mockTask)
			});

			// Inject the mock service
			(domain as any).taskService = mockTaskService;

			// Call with skipCount
			await domain.getNext('my-tag', 2);

			// Verify service was called with correct parameters
			expect(mockTaskService.getNextTask).toHaveBeenCalledWith('my-tag', 2);
		});

		it('should work without skipCount (backward compatibility)', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(mockTask)
			});

			(domain as any).taskService = mockTaskService;

			// Call without skipCount
			await domain.getNext('my-tag');

			// Verify service was called with undefined skipCount
			expect(mockTaskService.getNextTask).toHaveBeenCalledWith('my-tag', undefined);
		});

		it('should work with skipCount=0', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(mockTask)
			});

			(domain as any).taskService = mockTaskService;

			// Call with skipCount=0
			await domain.getNext(undefined, 0);

			// Verify service was called with 0
			expect(mockTaskService.getNextTask).toHaveBeenCalledWith(undefined, 0);
		});

		it('should work with skipCount>0', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(mockTask)
			});

			(domain as any).taskService = mockTaskService;

			// Call with skipCount=5
			await domain.getNext('test-tag', 5);

			// Verify service was called with 5
			expect(mockTaskService.getNextTask).toHaveBeenCalledWith('test-tag', 5);
		});

		it('should propagate errors from service layer', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockRejectedValue(new Error('Service error'))
			});

			(domain as any).taskService = mockTaskService;

			// Expect error to propagate
			await expect(domain.getNext('tag', 1)).rejects.toThrow('Service error');
		});

		it('should return task from service layer', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(mockTask)
			});

			(domain as any).taskService = mockTaskService;

			const result = await domain.getNext('tag', 1);

			expect(result).toEqual(mockTask);
		});

		it('should return null when no task found', async () => {
			const mockTaskService = createMockTaskService({
				getNextTask: vi.fn().mockResolvedValue(null)
			});

			(domain as any).taskService = mockTaskService;

			const result = await domain.getNext('tag', 1);

			expect(result).toBeNull();
		});
	});
});
