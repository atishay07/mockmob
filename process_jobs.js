// Removed node-fetch

async function worker(workerId, state) {
  let hasMore = true;
  while (hasMore) {
    try {
      const res = await fetch('http://localhost:3000/api/internal/moderation/process', {
        method: 'POST',
        headers: {
          'x-internal-secret': 'test-secret'
        }
      });
      
      const data = await res.json();
      
      if (data.processed) {
        state.processed++;
        if (state.processed % 50 === 0) {
           console.log(`[Worker ${workerId}] Processed so far: ${state.processed}`);
        }
      } else {
        if (data.reason === 'no_jobs') {
          hasMore = false;
        } else {
          console.error(`[Worker ${workerId}] Error:`, data);
          hasMore = false;
        }
      }
    } catch (e) {
      console.error(`[Worker ${workerId}] Network error:`, e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function run() {
  console.log('Starting parallel moderation workers...');
  const state = { processed: 0 };
  const numWorkers = 3;
  const workers = [];
  
  for (let i = 0; i < numWorkers; i++) {
    workers.push(worker(i + 1, state));
  }
  
  await Promise.all(workers);
  console.log(`Finished! Processed ${state.processed} jobs total across ${numWorkers} workers.`);
}

run();
