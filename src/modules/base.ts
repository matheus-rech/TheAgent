/**
 * Base module interface for all extraction modules
 */

import type { ExtractionOptions } from '../types/index.js';

export interface ExtractionModule<TInput, TOutput> {
  /** Module name */
  readonly name: string;

  /** Module description */
  readonly description: string;

  /** Whether this module is enabled */
  enabled: boolean;

  /**
   * Process the input and return extraction results
   * @param input - Module-specific input
   * @param options - Extraction options
   * @returns Module-specific output
   */
  process(input: TInput, options?: ExtractionOptions): Promise<TOutput>;

  /**
   * Validate that the module can run with current configuration
   * @throws Error if module cannot run
   */
  validate(): void;
}

/**
 * Base abstract class for modules to extend
 */
export abstract class BaseModule<TInput, TOutput> implements ExtractionModule<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;

  enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  abstract process(input: TInput, options?: ExtractionOptions): Promise<TOutput>;

  validate(): void {
    if (!this.enabled) {
      throw new Error(`Module ${this.name} is not enabled`);
    }
  }

  protected log(message: string, verbose?: boolean): void {
    if (verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  protected logError(message: string): void {
    console.error(`[${this.name}] ERROR: ${message}`);
  }
}
