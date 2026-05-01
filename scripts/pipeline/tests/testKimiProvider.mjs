import { fileURLToPath } from 'node:url';

function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }));
}

export async function runKimiProviderTool(args = parseArgs()) {
  if (args.provider) {
    process.env.KIMI_PROVIDER = String(args.provider).trim().toLowerCase();
    if (!args.model) process.env.KIMI_MODEL = defaultModelForProvider(process.env.KIMI_PROVIDER);
    if (!args.baseUrl && !args['base-url']) process.env.KIMI_BASE_URL = defaultBaseUrlForProvider(process.env.KIMI_PROVIDER);
  }
  if (args.model) process.env.KIMI_MODEL = String(args.model).trim();
  if (args.baseUrl || args['base-url']) process.env.KIMI_BASE_URL = String(args.baseUrl || args['base-url']).trim();

  const llm = await import(`../lib/llm.mjs?provider=${encodeURIComponent(process.env.KIMI_PROVIDER || '')}&t=${Date.now()}`);
  const config = llm.getKimiConfig();

  if (args.health) {
    const health = await llm.healthCheckKimi();
    const models = process.env.KIMI_DISCOVER_MODELS === 'true'
      ? await llm.discoverKimiModels()
      : null;
    return { config, health, models };
  }

  if (args.route) {
    const { runGeneratorAbTest } = await import(`../tools/abTestGenerators.mjs?t=${Date.now()}`);
    const report = await runGeneratorAbTest({
      route: args.route,
      models: args.models || 'deepseek-v4-flash,kimi',
      quality: args.quality || 'balanced',
      auditDir: args.auditDir,
    });
    return { config, report };
  }

  return { config };
}

function defaultBaseUrlForProvider(provider) {
  if (provider === 'deepinfra') return 'https://api.deepinfra.com/v1/openai';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  return 'https://api.moonshot.ai/v1';
}

function defaultModelForProvider(provider) {
  if (provider === 'deepinfra') return 'moonshotai/Kimi-K2.6';
  if (provider === 'openrouter') return 'moonshotai/kimi-k2.6';
  return 'kimi-k2.6';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runKimiProviderTool()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error('[test_kimi_provider] failed', error);
      process.exitCode = 1;
    });
}
