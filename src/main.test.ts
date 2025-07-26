import * as core from '@actions/core';
import * as github from '@actions/github';
import { run } from './main';

// Mock the GitHub context
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'pull_request',
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    },
    issue: {
      number: 123
    },
    sha: 'test-sha'
  },
  getOctokit: jest.fn()
}));

// Mock the core module
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn()
}));

describe('Diff Status Action', () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset github context
    (github.context as any).eventName = 'pull_request';
    (github.context as any).issue = { number: 123 };
    (github.context as any).repo = { owner: 'test-owner', repo: 'test-repo' };
    (github.context as any).sha = 'test-sha';

    // Setup mock inputs
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'token':
          return 'test-token';
        case 'globs':
          return '**/*.ts\n**/*.js';
        case 'statuses':
          return 'status1\nstatus2';
        default:
          return '';
      }
    });

    // Setup mock Octokit
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({
            data: [
              { filename: 'src/main.ts' },
              { filename: 'src/test.js' }
            ]
          })
        },
        repos: {
          createCommitStatus: jest.fn().mockResolvedValue({})
        }
      },
      paginate: {
        iterator: jest.fn().mockImplementation(function* () {
          // Default mock: single page with test files
          yield {
            data: [
              { filename: 'src/main.ts' },
              { filename: 'src/test.js' }
            ]
          };
        })
      }
    };
    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
  });

  it('should succeed when all files match glob patterns', async () => {
    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledTimes(2);
    expect(core.info).toHaveBeenCalledWith('Successfully updated all status checks');
  });

  it('should exit successfully without updating statuses when files do not match glob patterns', async () => {
    mockOctokit.paginate.iterator.mockImplementation(function* () {
      yield {
        data: [
          { filename: 'src/main.ts' },
          { filename: 'src/test.py' } // This won't match our globs
        ]
      };
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Changed files are not exempt from required statuses');
    expect(mockOctokit.rest.repos.createCommitStatus).not.toHaveBeenCalled();
  });

  it('should succeed and skip when not run on a pull request', async () => {
    (github.context as any).eventName = 'push';

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Action only runs on pull requests - skipping');
  });

  it('should succeed and skip when pull request number is missing', async () => {
    (github.context as any).eventName = 'pull_request';
    (github.context as any).issue = { number: undefined };

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Changed files are indeterminate (no pull request); skipping');
  });

  it('should succeed and skip when pull request number is null', async () => {
    (github.context as any).eventName = 'pull_request';
    (github.context as any).issue = { number: null };

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Changed files are indeterminate (no pull request); skipping');
  });

  it('should handle multiple pages of files when all match glob patterns', async () => {
    mockOctokit.paginate.iterator.mockImplementation(function* () {
      // First page
      yield {
        data: [
          { filename: 'src/main.ts' },
          { filename: 'src/utils.js' }
        ]
      };
      // Second page
      yield {
        data: [
          { filename: 'src/helpers.ts' },
          { filename: 'src/types.ts' }
        ]
      };
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledTimes(2);
    expect(core.info).toHaveBeenCalledWith('Successfully updated all status checks');
  });

  it('should handle multiple pages and exit on first non-matching file', async () => {
    mockOctokit.paginate.iterator.mockImplementation(function* () {
      // First page - all matching
      yield {
        data: [
          { filename: 'src/main.ts' },
          { filename: 'src/utils.js' }
        ]
      };
      // Second page - contains non-matching file
      yield {
        data: [
          { filename: 'src/helpers.ts' },
          { filename: 'README.md' } // This won't match our *.ts/*.js globs
        ]
      };
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Changed files are not exempt from required statuses');
    expect(mockOctokit.rest.repos.createCommitStatus).not.toHaveBeenCalled();
  });

  it('should handle large number of files across many pages', async () => {
    mockOctokit.paginate.iterator.mockImplementation(function* () {
      // Simulate 5 pages with 100 files each (500 files total)
      for (let page = 1; page <= 5; page++) {
        const pageData: { filename: string }[] = [];
        for (let file = 1; file <= 100; file++) {
          pageData.push({ filename: `src/page${page}_file${file}.ts` });
        }
        yield { data: pageData };
      }
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledTimes(2);
    expect(core.info).toHaveBeenCalledWith('Successfully updated all status checks');
  });
});
