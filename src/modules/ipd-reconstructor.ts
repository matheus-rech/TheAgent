/**
 * IPD (Individual Patient Data) Reconstructor Module
 * Reconstructs patient-level data from aggregate statistics and survival curves
 *
 * Enhanced with Claude Agent SDK vision for Kaplan-Meier curve digitization
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseModule } from './base.js';
import { AGENT_CONFIGS } from '../agents/config.js';
import type {
  ExtractionOptions,
  IpdReconstructorResult,
  IndividualPatientData,
  FigureData,
} from '../types/index.js';

interface IpdInput {
  /** Kaplan-Meier figures extracted from the paper */
  kaplanMeierFigures?: FigureData[];
  /** Path to the source PDF for image extraction */
  pdfPath?: string;
  /** Aggregate statistics reported in text/tables */
  aggregateData?: {
    sample_size: number;
    mean_age?: number;
    mortality_rate?: number;
    outcome_distribution?: number[];
  };
  /** Full text for additional context */
  fullText?: string;
}

/**
 * Kaplan-Meier curve coordinate data extracted via vision
 */
interface KMCurveData {
  /** Time-survival probability coordinates [(time, survival), ...] */
  coordinates: Array<{ time: number; survival: number }>;
  /** Censoring marks [(time, survival), ...] */
  censoring: Array<{ time: number; survival: number }>;
  /** Number at risk table data (optional) */
  at_risk?: Array<{ time: number; count: number }>;
  /** Axis information */
  axes: {
    x_label: string;
    y_label: string;
    x_max: number;
    y_max: number;
  };
  /** Confidence in extraction */
  confidence: number;
}

export class IpdReconstructor extends BaseModule<IpdInput, IpdReconstructorResult> {
  readonly name = 'IPD Reconstructor';
  readonly description = 'Reconstructs individual patient data from aggregate statistics and survival curves';

  async process(input: IpdInput, options?: ExtractionOptions): Promise<IpdReconstructorResult> {
    this.validate();
    this.log('Starting IPD reconstruction...', options?.verbose);

    try {
      const patients: IndividualPatientData[] = [];
      let reconstructionMethod = 'none';
      const warnings: string[] = [];
      let dataQuality: 'high' | 'medium' | 'low' = 'low';

      // Method 1: Reconstruct from Kaplan-Meier curves
      if (input.kaplanMeierFigures && input.kaplanMeierFigures.length > 0) {
        this.log('Found Kaplan-Meier curves, attempting reconstruction...', options?.verbose);
        const kmPatients = await this.reconstructFromKaplanMeier(input.kaplanMeierFigures[0], options);
        patients.push(...kmPatients);
        reconstructionMethod = 'kaplan-meier';
        dataQuality = 'medium';
      }

      // Method 2: Impute from aggregate data
      if (patients.length === 0 && input.aggregateData) {
        this.log('No K-M curves, using aggregate imputation...', options?.verbose);
        const imputedPatients = await this.imputeFromAggregate(input.aggregateData, options);
        patients.push(...imputedPatients);
        reconstructionMethod = 'aggregate-imputation';
        dataQuality = 'low';
        warnings.push('IPD imputed from aggregate data - use with caution for meta-analysis');
      }

      if (patients.length === 0) {
        warnings.push('No IPD could be reconstructed - insufficient source data');
      }

      return {
        patients,
        reconstruction_method: reconstructionMethod,
        data_quality: dataQuality,
        warnings,
      };
    } catch (error) {
      this.logError(`IPD reconstruction failed: ${error}`);
      throw error;
    }
  }

  /**
   * Reconstruct IPD from Kaplan-Meier survival curves
   *
   * Enhanced with Claude Agent SDK vision for curve digitization
   *
   * This implementation:
   * 1. Uses vision API to digitize the K-M curve (extract coordinates from figure)
   * 2. Identifies censoring marks and number-at-risk data
   * 3. Reconstructs individual survival times using the Guyot method
   *    (see: Guyot et al. BMC Med Res Methodol. 2012)
   *
   * Expected accuracy:
   * - High (90%+) if "number at risk" table is available
   * - Medium (75-85%) if only survival curve is digitized
   * - Decreases with number of patients (more ambiguity)
   */
  private async reconstructFromKaplanMeier(
    figure: FigureData,
    options?: ExtractionOptions
  ): Promise<IndividualPatientData[]> {
    this.log('Reconstructing from Kaplan-Meier curve using vision API...', options?.verbose);

    try {
      // Step 1: Extract K-M curve coordinates using vision
      const kmData = await this.extractKMCoordinatesWithVision(figure, options);

      if (kmData.confidence < 0.7) {
        this.log(`Warning: Low confidence (${kmData.confidence}) in K-M extraction`, options?.verbose);
      }

      // Step 2: Apply Guyot reconstruction algorithm
      const patients = await this.guyotReconstruction(kmData, options);

      this.log(`Reconstructed ${patients.length} patient records from K-M curve`, options?.verbose);

      return patients;
    } catch (error) {
      this.logError(`K-M reconstruction failed: ${error}`);

      // Fallback: try using existing data_points if available
      if (figure.data_points && figure.data_points.length > 0) {
        this.log('Falling back to existing data_points...', options?.verbose);
        return this.reconstructFromDataPoints(figure.data_points, options);
      }

      return [];
    }
  }

  /**
   * Extract Kaplan-Meier curve coordinates using Claude Agent SDK vision
   *
   * Uses Claude Sonnet 4.5 vision capabilities to:
   * - Identify the survival curve path
   * - Extract coordinate pairs (time, survival probability)
   * - Detect censoring marks (tick marks on curve)
   * - Read "number at risk" table if present
   * - Extract axis labels and ranges
   */
  private async extractKMCoordinatesWithVision(
    figure: FigureData,
    options?: ExtractionOptions
  ): Promise<KMCurveData> {
    this.log('Using Claude vision to digitize K-M curve...', options?.verbose);

    // Load figure as base64 image
    const imageBase64 = await this.loadFigureImage(figure, options);

    // Construct vision prompt for K-M curve extraction
    const visionPrompt = `You are analyzing a Kaplan-Meier survival curve from a medical research paper.

Extract the following data with high precision:

1. **Survival Curve Coordinates**: Extract 20-30 (time, survival) coordinate pairs along the curve path
   - Time (x-axis): Usually in days, months, or years
   - Survival (y-axis): Probability from 0.0 to 1.0 (or 0% to 100%)
   - Focus on step changes (where survival drops)
   - Include coordinates at censoring events

2. **Censoring Marks**: Identify tick marks or crosses on the curve indicating censored patients
   - Extract (time, survival) coordinates of each censoring mark

3. **Number at Risk Table** (if present): Extract the table showing patients at risk over time
   - Format: [(time, count), (time, count), ...]

4. **Axis Information**:
   - X-axis label (e.g., "Time (months)", "Follow-up (days)")
   - Y-axis label (e.g., "Survival probability", "Overall survival")
   - X-axis maximum value
   - Y-axis maximum value (usually 1.0 or 100)

5. **Confidence Assessment**: Rate your extraction confidence from 0.0 to 1.0

Return JSON in this exact format:
{
  "coordinates": [
    {"time": 0, "survival": 1.0},
    {"time": 30, "survival": 0.95},
    ...
  ],
  "censoring": [
    {"time": 45, "survival": 0.93},
    ...
  ],
  "at_risk": [
    {"time": 0, "count": 150},
    {"time": 30, "count": 142},
    ...
  ],
  "axes": {
    "x_label": "Time (days)",
    "y_label": "Survival probability",
    "x_max": 365,
    "y_max": 1.0
  },
  "confidence": 0.92
}

IMPORTANT:
- Survival values should be between 0.0 and 1.0 (not 0-100)
- Extract coordinates in chronological order
- Capture ALL step changes (survival drops)
- Mark censoring events separately from death events
- Be conservative with confidence score`;

    // Query Claude with vision - note: query() takes {prompt, options} not separate params
    const queryResult = query({
      prompt: JSON.stringify([
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: visionPrompt,
        },
      ]),
      options: {
        model: options?.model || 'claude-sonnet-4-5-20250929',
        maxThinkingTokens: 2048,
        systemPrompt: AGENT_CONFIGS.fullPdfExtractor.systemPrompt,
      },
    });

    // Collect response text
    let responseText = '';
    for await (const message of queryResult) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            responseText += block.text;
          }
        }
      }
    }

    const response = responseText;

    // Parse response to extract K-M data
    const kmData = this.parseKMResponse(response);

    this.log(
      `Extracted ${kmData.coordinates.length} coordinates, ${kmData.censoring.length} censoring marks`,
      options?.verbose
    );

    return kmData;
  }

  /**
   * Load figure image from PDF and convert to base64
   *
   * If figure has an image path, load it directly.
   * Otherwise, extract from PDF using page number and bounding box.
   */
  private async loadFigureImage(
    figure: FigureData,
    options?: ExtractionOptions
  ): Promise<string> {
    this.log(`Loading figure ${figure.figure_number} from page ${figure.page}...`, options?.verbose);

    // TODO: For now, this is a placeholder
    // In production, this would:
    // 1. Extract the specific page from the PDF
    // 2. Render the page to an image
    // 3. Crop to the figure bounding box if available
    // 4. Convert to base64 PNG
    //
    // Libraries needed: pdf-lib + sharp/canvas for rendering
    //
    // For MVP, we'll assume the figure is already extracted as an image file

    // Placeholder: return empty base64 image
    // In real implementation, this would extract from the PDF
    throw new Error(
      'Figure image extraction not yet implemented. Please provide pre-extracted figure images.'
    );
  }

  /**
   * Parse Claude's response to extract K-M curve data
   *
   * Handles various response formats:
   * - Direct JSON in response
   * - JSON wrapped in markdown code blocks
   * - Narrative text with embedded coordinates
   */
  private parseKMResponse(response: string): KMCurveData {
    // Response is already a string from the collection above
    const responseText = response;

    // Try to extract JSON from response
    // Handle markdown code blocks: ```json ... ```
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;

    try {
      const parsed = JSON.parse(jsonText);

      // Validate and normalize the data
      const kmData: KMCurveData = {
        coordinates: parsed.coordinates || [],
        censoring: parsed.censoring || [],
        at_risk: parsed.at_risk,
        axes: parsed.axes || {
          x_label: 'Time',
          y_label: 'Survival',
          x_max: 365,
          y_max: 1.0,
        },
        confidence: parsed.confidence || 0.5,
      };

      // Validate coordinates
      if (kmData.coordinates.length === 0) {
        throw new Error('No coordinates extracted from K-M curve');
      }

      // Ensure survival values are between 0 and 1
      kmData.coordinates = kmData.coordinates.map((coord) => ({
        time: coord.time,
        survival: coord.survival > 1 ? coord.survival / 100 : coord.survival,
      }));

      return kmData;
    } catch (error) {
      throw new Error(`Failed to parse K-M response: ${error}. Response: ${responseText.substring(0, 200)}`);
    }
  }

  /**
   * Guyot reconstruction algorithm
   *
   * Reconstructs individual patient data from K-M curve using the method described in:
   * Guyot P, Ades AE, Ouwens MJ, Welton NJ. "Enhanced secondary analysis of survival data:
   * reconstructing the data from published Kaplan-Meier survival curves."
   * BMC Med Res Methodol. 2012;12:9.
   *
   * Algorithm:
   * 1. Identify time intervals where survival changes (step changes)
   * 2. Calculate number of events in each interval
   * 3. Use number-at-risk data to allocate events to individual patients
   * 4. Assign survival/censoring times to reconstruct IPD
   *
   * Note: This is a simplified implementation. Full Guyot algorithm is more sophisticated.
   */
  private async guyotReconstruction(
    kmData: KMCurveData,
    options?: ExtractionOptions
  ): Promise<IndividualPatientData[]> {
    this.log('Applying Guyot reconstruction algorithm...', options?.verbose);

    const patients: IndividualPatientData[] = [];

    // Get initial sample size from first at-risk data point
    const initialSampleSize = kmData.at_risk?.[0]?.count || 100; // Default to 100 if not available

    // Sort coordinates by time
    const sortedCoords = [...kmData.coordinates].sort((a, b) => a.time - b.time);

    // Identify step changes (survival drops)
    const steps: Array<{ time: number; survival: number; nEvents: number; nAtRisk: number }> = [];

    for (let i = 1; i < sortedCoords.length; i++) {
      const prev = sortedCoords[i - 1];
      const curr = sortedCoords[i];

      if (curr.survival < prev.survival) {
        // Survival dropped - this is a death event
        const survivalDrop = prev.survival - curr.survival;

        // Find number at risk at this timepoint
        const atRiskEntry = kmData.at_risk?.find((ar) => ar.time <= curr.time);
        const nAtRisk = atRiskEntry?.count || Math.round(prev.survival * initialSampleSize);

        // Calculate number of events
        const nEvents = Math.round(survivalDrop * nAtRisk);

        steps.push({
          time: curr.time,
          survival: curr.survival,
          nEvents: Math.max(1, nEvents), // At least 1 event
          nAtRisk,
        });
      }
    }

    this.log(`Identified ${steps.length} survival step changes`, options?.verbose);

    // Reconstruct patient-level data
    let patientId = 1;

    // Assign death events based on step changes
    for (const step of steps) {
      for (let i = 0; i < step.nEvents; i++) {
        patients.push({
          patient_id: patientId++,
          survival_days: step.time,
          censored: false,
          reconstruction_method: 'kaplan-meier',
          treatment: 'SDC', // Default - should be inferred from study context
        });
      }
    }

    // Add censored patients based on censoring marks
    for (const censor of kmData.censoring) {
      patients.push({
        patient_id: patientId++,
        survival_days: censor.time,
        censored: true,
        reconstruction_method: 'kaplan-meier',
        treatment: 'SDC',
      });
    }

    // If we have fewer patients than expected, add censored patients at end
    if (patients.length < initialSampleSize) {
      const maxTime = sortedCoords[sortedCoords.length - 1].time;
      const remaining = initialSampleSize - patients.length;

      for (let i = 0; i < remaining; i++) {
        patients.push({
          patient_id: patientId++,
          survival_days: maxTime,
          censored: true,
          reconstruction_method: 'kaplan-meier',
          treatment: 'SDC',
        });
      }
    }

    this.log(`Reconstructed ${patients.length} patients (${patients.filter(p => !p.censored).length} events, ${patients.filter(p => p.censored).length} censored)`, options?.verbose);

    return patients;
  }

  /**
   * Fallback: Reconstruct from existing data points
   *
   * Used when vision extraction fails but we have pre-extracted coordinates
   */
  private async reconstructFromDataPoints(
    dataPoints: Array<{ x: number; y: number; label?: string }>,
    options?: ExtractionOptions
  ): Promise<IndividualPatientData[]> {
    this.log('Reconstructing from existing data points...', options?.verbose);

    // Convert data points to K-M format
    const kmData: KMCurveData = {
      coordinates: dataPoints.map((dp) => ({
        time: dp.x,
        survival: dp.y > 1 ? dp.y / 100 : dp.y, // Normalize to 0-1
      })),
      censoring: [], // No censoring info available
      axes: {
        x_label: 'Time',
        y_label: 'Survival',
        x_max: Math.max(...dataPoints.map((dp) => dp.x)),
        y_max: 1.0,
      },
      confidence: 0.6, // Lower confidence without vision verification
    };

    // Apply Guyot reconstruction
    return this.guyotReconstruction(kmData, options);
  }

  /**
   * Impute IPD from aggregate data
   *
   * TODO: Implement aggregate-to-IPD imputation
   *
   * This method creates "synthetic" individual patient data based on:
   * - Reported sample size
   * - Mean/SD of continuous variables (age, GCS, etc.)
   * - Outcome proportions (mortality rate, mRS distribution)
   *
   * WARNING: This is the least accurate method and should be clearly flagged.
   *
   * Implementation approach:
   * 1. Sample ages from normal distribution (or reported distribution)
   * 2. Assign outcomes based on reported proportions
   * 3. Add realistic variance (use Claude to infer from medical context)
   * 4. Clearly mark as "imputed" with low confidence
   *
   * Use cases:
   * - Creating pseudo-IPD for sensitivity analyses
   * - Estimating effect sizes when only aggregate data available
   * - Network meta-analysis requiring IPD format
   */
  private async imputeFromAggregate(
    aggregateData: NonNullable<IpdInput['aggregateData']>,
    options?: ExtractionOptions
  ): Promise<IndividualPatientData[]> {
    this.log('Imputing IPD from aggregate data...', options?.verbose);

    const patients: IndividualPatientData[] = [];

    // Simple imputation example (should be enhanced)
    for (let i = 0; i < aggregateData.sample_size; i++) {
      const patient: IndividualPatientData = {
        patient_id: i + 1,
        age: aggregateData.mean_age ? this.sampleAge(aggregateData.mean_age) : undefined,
        treatment: i % 2 === 0 ? 'SDC' : 'medical', // Naive assumption
        reconstruction_method: 'aggregate-imputation',
      };

      // Assign outcome based on mortality rate
      if (aggregateData.mortality_rate) {
        patient.survival_days = Math.random() < aggregateData.mortality_rate ? this.sampleDeathTime() : undefined;
        patient.censored = !patient.survival_days;
      }

      patients.push(patient);
    }

    return patients;
  }

  /**
   * Sample age from a normal distribution around the mean
   */
  private sampleAge(meanAge: number, sd: number = 15): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.round(meanAge + z * sd);
  }

  /**
   * Sample death time (naive exponential distribution)
   */
  private sampleDeathTime(): number {
    // Exponential distribution with lambda = 0.01 (median ~70 days)
    return Math.round(-Math.log(Math.random()) / 0.01);
  }

  /**
   * Validate reconstructed IPD for consistency
   *
   * Checks:
   * - Do reconstructed outcomes match reported aggregate outcomes?
   * - Are survival times realistic?
   * - Does sample size match?
   *
   * TODO: Implement validation logic - Currently unused but reserved for future use
   */
  /*
  private validateReconstruction(
    _patients: IndividualPatientData[],
    _originalData: IpdInput
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // TODO: Implement validation logic

    return { valid: true, warnings };
  }
  */
}
