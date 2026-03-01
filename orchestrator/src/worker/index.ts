
import { PrismaClient, CapsuleStatus } from '@prisma/client';
import { ModelAdapter, LLMConfig, CapabilityTester, ModelCapability, PromptEngine } from '../ai';
import { generateEmbedding } from '../services/embedding';
import { Sanitizer } from '../services/sanitizer';
import { VisionService } from '../services/vision';
import { DeduplicationService } from '../services/deduplication';
import { minioClient, BUCKET_NAME } from '../config/minio';
import { loadSettings, onSettingsUpdate, type ModelSettings } from '../routes/settings';
import fs from 'fs';
import os from 'os';
import path from 'path';

const prisma = new PrismaClient();

// Dynamic config — loaded from settings file (falls back to env vars)
function buildConfigs(settings: ModelSettings) {
  const localConfig: LLMConfig = {
    endpoint: settings.local.endpoint,
    modelName: settings.local.modelName,
    apiKey: settings.local.apiKey,
  };
  const cloudConfig: LLMConfig = {
    endpoint: settings.cloud.endpoint,
    modelName: settings.cloud.modelName,
    apiKey: settings.cloud.apiKey,
  };
  const visionConfig: LLMConfig = {
    endpoint: settings.vision.endpoint,
    modelName: settings.vision.modelName,
    apiKey: settings.vision.apiKey,
  };
  return { localConfig, cloudConfig, visionConfig };
}

let currentSettings = loadSettings();
let { localConfig, cloudConfig, visionConfig } = buildConfigs(currentSettings);

let localAdapter = new ModelAdapter(localConfig);
let cloudAdapter = new ModelAdapter(cloudConfig);

let localCapability = ModelCapability.BASIC;
let cloudCapability = ModelCapability.UNUSABLE;

// Hot-reload handler — called by settings API when config changes
export function reloadConfig(settings: ModelSettings) {
  console.log('[Worker] Hot-reloading model configuration...');
  currentSettings = settings;
  const configs = buildConfigs(settings);
  localConfig = configs.localConfig;
  cloudConfig = configs.cloudConfig;
  visionConfig = configs.visionConfig;

  localAdapter = new ModelAdapter(localConfig);
  cloudAdapter = new ModelAdapter(cloudConfig);

  // Re-configure vision (always VLM)
  VisionService.configure(visionConfig);

  console.log('[Worker] Config reloaded. Local:', localConfig.endpoint, localConfig.modelName);
  console.log('[Worker] Config reloaded. Cloud:', cloudConfig.endpoint, cloudConfig.modelName);
}

export const startWorker = async () => {
  console.log('Worker started. Initializing AI capabilities...');

  // Configure Vision (always VLM)
  VisionService.configure(visionConfig);
  console.log(`[Worker] VLM configured: ${visionConfig.endpoint} / ${visionConfig.modelName}`);

  // Register hot-reload callback
  onSettingsUpdate(reloadConfig);

  // Check Local
  try {
    localCapability = await new CapabilityTester(localConfig).runTests();
    console.log(`[Local] Capability: ${localCapability}`);
  } catch (e) {
    console.warn(`[Local] Check Failed: ${e}. Defaulting to BASIC.`); // Should ideally mark usable=false
  }

  // Check Cloud (if configured)
  if (cloudConfig.apiKey) {
    try {
      cloudCapability = await new CapabilityTester(cloudConfig).runTests();
      console.log(`[Cloud] Capability: ${cloudCapability}`);
    } catch (e) {
      console.warn(`[Cloud] Check Failed: ${e}`);
    }
  }

  poll();
};

const poll = async () => {
  try {
    const capsule = await prisma.capsule.findFirst({
      where: { status: CapsuleStatus.PENDING },
      orderBy: { createdAt: 'asc' }
    });

    if (capsule) {
      console.log(`Processing Capsule: ${capsule.id}`);
      await processCapsule(capsule.id);
    }
  } catch (error) {
    console.error('Worker polling error:', error);
  } finally {
    setTimeout(poll, 5000); // 5s Interval
  }
};

const processCapsule = async (capsuleId: string) => {
  try {
    await prisma.capsule.update({
      where: { id: capsuleId },
      data: { status: CapsuleStatus.PROCESSING }
    });

    const capsule = await prisma.capsule.findUnique({ where: { id: capsuleId } });
    if (!capsule) throw new Error('Capsule content missing');

    // 0. Multi-Modal Parsing Pipeline
    let aggregatedContent = capsule.rawContent || '';

    // A. Implicit Web Crawling
    // Extract any URLs typed or pasted into the text content
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlsFound = aggregatedContent.match(urlRegex) || [];

    if (urlsFound.length > 0) {
      console.log(`[Worker] Found ${urlsFound.length} explicit URLs in text. Crawling...`);
      const { CrawlerService } = await import('../services/crawler');

      for (const url of urlsFound) {
        try {
          const crawled = await CrawlerService.crawl(url);
          aggregatedContent += `\n\n[Crawled content from ${url}]:\n${crawled.content}\n---`;
        } catch (crawlErr) {
          console.warn(`[Worker] Failed to crawl ${url}: ${crawlErr}`);
        }
      }
    }

    // B. Multi-Asset Vision (OCR)
    // Run VLM to extract/analyze actual content from all uploaded files.
    const assets = await prisma.asset.findMany({ where: { capsuleId } });
    if (assets.length > 0) {
      console.log(`[Worker] File assets detected (${assets.length}). Running VLM Pipeline for all...`);

      for (const asset of assets) {
        try {
          // Download file from MinIO to temp directory
          const tempDir = path.join(os.tmpdir(), 'capsula-vision');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const tempFile = path.join(tempDir, asset.storagePath);
          console.log(`[Worker] Downloading ${asset.storagePath} from MinIO → ${tempFile}`);

          const dataStream = await minioClient.getObject(BUCKET_NAME, asset.storagePath);
          const writeStream = fs.createWriteStream(tempFile);

          await new Promise<void>((resolve, reject) => {
            dataStream.pipe(writeStream);
            dataStream.on('error', reject);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          console.log(`[Worker] Downloaded ${asset.fileName}. Running VLM analysis...`);
          const extractedText = await VisionService.analyzeFile(tempFile);

          if (extractedText && extractedText.trim().length > 0) {
            aggregatedContent += `\n\n[Content from ${asset.fileName || 'Asset'}]:\n${extractedText}\n---`;
            console.log(`[Worker] VLM extracted ${extractedText.length} chars from ${asset.fileName}.`);
          } else {
            console.log(`[Worker] [VLM] No content could be extracted from ${asset.fileName}`);
          }

          // Clean up temp file
          try { fs.unlinkSync(tempFile); } catch (_) { /* ignore cleanup errors */ }
        } catch (e) {
          console.warn(`[Worker] VLM Pipeline Failed for ${asset.fileName}: ${e}`);
        }
      }
    }

    capsule.rawContent = aggregatedContent.trim();
    if (!capsule.rawContent) {
      // If still empty after web and OCR attempts
      throw new Error('Capsule content missing');
    }

    // Persist extracted mega-content to DB immediately so it's not lost
    await prisma.capsule.update({
      where: { id: capsuleId },
      data: { rawContent: capsule.rawContent }
    });

    // 1. Sanitize (Privacy Guard) - Always do this, we need it if we fall back to cloud
    const { sanitized, map } = Sanitizer.sanitize(capsule.rawContent!);
    const isSanitized = Object.keys(map).length > 0;

    // Routing Logic:
    // If Local is ADVANCED, use Local.
    // If Local is BASIC/UNUSABLE and Cloud is ADVANCED, might prefer Cloud for complex tasks.
    // For now, "Local First" means try Local first.
    // However, if we sanitize, we can safely use Cloud.

    let activeAdapter = localAdapter;
    let activeCapability = localCapability;
    let usingCloud = false;

    // Simple strategy: If Local is UNUSABLE (or failed check), try Cloud.
    // Or if user specifically requested "deep_reasoning" (future feature).
    // Here we stick to: Try Local. If Logic requires Advanced and Local is Basic, swap? 
    // Let's implement: Try Local. If it fails (exception) or returns garbage, could retry on Cloud.

    // For PRD "Cloud Assist": If we wanted to use Cloud for complex tasks, we'd check capability here.
    if (localCapability === ModelCapability.UNUSABLE && cloudCapability !== ModelCapability.UNUSABLE) {
      console.log(`[Worker] Local unusable, switching to Cloud.`);
      activeAdapter = cloudAdapter;
      activeCapability = cloudCapability;
      usingCloud = true;
    }

    // 4. Complexity Analysis (Routing)
    // Use Local Model to judge if we need Cloud aid
    let complexity = 'SIMPLE';
    try {
      const analyzePrompt = PromptEngine.getComplexityAnalysisPrompt(capsule.rawContent!);
      // Quick check using Local Adapter
      const analysisRes = await localAdapter.chatCompletion([{ role: 'user', content: analyzePrompt }], true);
      const analysisJson = JSON.parse(analysisRes.content.replace(/```json|```/g, '').trim());
      complexity = analysisJson.complexity || 'SIMPLE';
      console.log(`[Worker] Task Complexity Analysis: ${complexity}`);
    } catch (e) {
      console.warn(`[Worker] Complexity Analysis failed, defaulting to SIMPLE. Error: ${e}`);
    }

    // Routing Decision:
    // If COMPLEX and Cloud is available -> Use Cloud (Enhanced)
    // If SIMPLE -> Use Local
    if (complexity === 'COMPLEX' && cloudCapability !== ModelCapability.UNUSABLE) {
      console.log(`[Worker] Routing to Cloud for COMPLEX task (Sanitized).`);
      activeAdapter = cloudAdapter;
      activeCapability = cloudCapability;
      usingCloud = true;
    }

    // Note: WEBSITE capsules previously forced Local LLM, but this caused relationship extraction
    // to fail with basic models because the BASIC prompt doesn't reliably produce relationships.
    // Now WEBSITE capsules follow the same routing logic as all other types.

    const contentToProcess = usingCloud ? sanitized : capsule.rawContent!;
    const prompt = PromptEngine.getExtractionPrompt(contentToProcess, activeCapability);

    // 5. Execution
    let aiResponse;
    try {
      aiResponse = await activeAdapter.chatCompletion([
        { role: 'user', content: prompt }
      ], true);
    } catch (primaryError) {
      console.warn(`[Worker] Primary inference failed: ${primaryError}`);

      // Fallback Logic
      if (!usingCloud && cloudCapability !== ModelCapability.UNUSABLE) {
        console.log(`[Worker] Local failed, retrying with Cloud...`);
        const cloudPrompt = PromptEngine.getExtractionPrompt(sanitized, cloudCapability);
        aiResponse = await cloudAdapter.chatCompletion([
          { role: 'user', content: cloudPrompt }
        ], true);
        usingCloud = true;
      } else {
        throw primaryError;
      }
    }

    // 4. Parse JSON & Quality Check
    let structuredData: any = {};
    let parseSuccess = false;

    try {
      const cleanJson = aiResponse.content.replace(/```json|```/g, '').trim();
      structuredData = JSON.parse(cleanJson);
      parseSuccess = true;
    } catch (e) {
      console.warn(`[Worker] Local JSON Parse Failed: ${e}`);
    }

    // QUALITY ESCALATION:
    // If Local produced invalid JSON (garbage), and we haven't tried Cloud yet, TRY CLOUD.
    if (!parseSuccess && !usingCloud && cloudCapability !== ModelCapability.UNUSABLE) {
      console.log(`[Worker] Local output invalid. Escalating to Cloud for enhancement...`);

      try {
        const cloudPrompt = PromptEngine.getExtractionPrompt(sanitized, cloudCapability);
        const cloudResponse = await cloudAdapter.chatCompletion([
          { role: 'user', content: cloudPrompt }
        ], true);

        const cloudJson = cloudResponse.content.replace(/```json|```/g, '').trim();
        structuredData = JSON.parse(cloudJson);
        usingCloud = true; // Mark as used
        console.log(`[Worker] Cloud rescue successful.`);
      } catch (cloudErr) {
        console.error(`[Worker] Cloud escalation also failed: ${cloudErr}`);
        structuredData = { error: 'Extraction Failed (Local+Cloud)', raw: aiResponse.content };
      }
    } else if (!parseSuccess) {
      // Failed and no cloud fallback available/possible
      structuredData = { error: 'Failed to parse JSON', raw: aiResponse.content };
    }

    // 5. Restore PII (Privacy Restore)
    // Only strictly needed if we sanitized, but safe to run always
    structuredData = Sanitizer.restore(structuredData, map);

    // 6. Data Evolution: Version Tagging
    // Inject schema version so we can identify this data format later
    structuredData.schema_version = "v1.0";

    // 6. Generate Embedding (for the original content + summary)
    // We use the ORIGINAL content for embedding, as local embedding model is safe/local
    const summary = structuredData.content?.summary || capsule.rawContent!.substring(0, 500);
    const embedding = await generateEmbedding(capsule.rawContent + '\n' + summary);

    // Prepare embeddings for creation
    const embeddings = [{
      vector: `[${embedding.join(',')}]`, // Convert number[] to pgvector text format
      contentChunk: summary,
      chunkIndex: 0
    }];

    // 7. Save & Complete (Atomic Transaction)
    // 7. Save & Complete (Atomic Transaction)
    await prisma.$transaction(async (tx: any) => {
      // Update Capsule Status & Data
      await tx.capsule.update({
        where: { id: capsuleId },
        data: {
          status: CapsuleStatus.COMPLETED,
          isSanitized: isSanitized,
          summary: structuredData.content?.summary || null
        }
      });

      // Insert Embedding (Vector)
      // Note: We use executeRaw because Prisma's typed client for 'Unsupported("vector")' is limited.
      const vectorStr = `[${embedding.join(',')}]`;
      const summarySafe = summary.replace(/\0/g, ''); // Remove null bytes if any

      await tx.$executeRaw`
            INSERT INTO "Embedding" ("id", "objectType", "objectId", "vector", "capsuleId")
            VALUES (gen_random_uuid(), 'CAPSULE'::"ObjectType", ${capsuleId}, ${vectorStr}::vector, ${capsuleId});
        `;
    });

    console.log(`[Worker] Capsule ${capsule.id} processed and saved.`);

    // 8. Entity Linking (Graph Population) - Phase 2
    if (structuredData && structuredData.entities && Array.isArray(structuredData.entities)) {
      console.log(`[Worker] Linking ${structuredData.entities.length} entities...`);

      for (const entity of structuredData.entities) {
        if (!entity.name || !entity.type) continue;

        const safeName = String(entity.name).trim();
        const safeType = String(entity.type).toUpperCase().trim();

        try {
          // Upsert Entity and connect to Capsule
          // We use a separate transaction or just standard Prisma call for each to ensure identifying existing entities
          // Note: Prisma's implicit m-n relations require 'connect' or 'create'.
          // Since we don't know if entity exists, we use 'upsert' pattern logic:
          // But implicit m-n doesn't support 'connectOrCreate' directly on the relation update easily without ID.
          // So we explicitly Upsert the Entity first, then Connect.

          const normalizedName = safeName.toLowerCase().trim();
          let dbEntity = await prisma.entity.findFirst({
            where: { normalizedName, type: safeType }
          });
          if (!dbEntity) {
            dbEntity = await prisma.entity.create({
              data: {
                canonicalName: safeName,
                normalizedName,
                type: safeType
              }
            });
          }

          // Link to Capsule
          await prisma.capsuleEntity.create({
            data: {
              capsuleId: capsule.id,
              entityId: dbEntity.id
            }
          });

        } catch (err) {
          console.warn(`[Worker] Failed to link entity ${safeName}: ${err}`);
        }
      }
      console.log(`[Worker] Linked entities complete.`);
    }

    // 9. Relationship Extraction (Phase 3.1)
    if (structuredData && structuredData.relationships && Array.isArray(structuredData.relationships)) {
      console.log(`[Worker] Extracting ${structuredData.relationships.length} relationships...`);
      try {
        const { RelationshipService } = await import('../services/relationship');
        const count = await RelationshipService.extractFromCapsule(capsuleId, structuredData.relationships);
        console.log(`[Worker] Created/Updated ${count.length} relationships.`);
      } catch (err) {
        console.warn(`[Worker] Relationship extraction failed: ${err}`);
      }
    }

    // 10. Similarity Detection (Phase 2.5)
    try {
      const similarCapsules = await DeduplicationService.findSimilarCapsules(embedding, 0.95);
      if (similarCapsules.length > 0) {
        const mostSimilar = similarCapsules[0];
        console.log(`[Worker] Found similar capsule: ${mostSimilar.id} (similarity: ${mostSimilar.score.toFixed(3)})`);
        await DeduplicationService.markAsSimilar(capsuleId, mostSimilar.id, mostSimilar.score);
      }
    } catch (err) {
      console.warn(`[Worker] Similarity detection failed: ${err}`);
    }

  } catch (error) {
    console.error(`Error processing capsule ${capsuleId}: `, error);
    await prisma.capsule.update({
      where: { id: capsuleId },
      data: { status: CapsuleStatus.FAILED }
    });
  }
};
