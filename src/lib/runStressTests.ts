#!/usr/bin/env node

/**
 * Stress Test Runner - Executes the full test suite
 */

import { stressTestSuite } from '../lib/stressTest.js';
import { performanceMonitor } from '../lib/performanceMonitor.js';
import { errorHandler } from '../lib/errorHandler.js';
import fs from 'fs';
import path from 'path';

async function runStressTests() {
  const runCount = 20;
  const allResults: any[] = [];
  const startTime = Date.now();

  console.log('🔥 EMS Guardian - Stress Test Runner');
  console.log(`Running ${runCount} complete test cycles...\n`);

  for (let run = 1; run <= runCount; run++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`RUN ${run}/${runCount}`);
    console.log(`${'═'.repeat(60)}`);

    // Clear previous metrics
    performanceMonitor.clearMetrics();
    errorHandler.clearLogs();

    // Run tests
    const results = await stressTestSuite.run({
      iterations: 100,
      concurrency: 10,
      timeout: 30000,
      verbose: true
    });

    // Get performance stats
    const stats = performanceMonitor.getStats();

    allResults.push({
      run,
      testResults: results,
      performanceStats: stats,
      timestamp: new Date().toISOString()
    });

    // Cool down between runs
    if (run < runCount) {
      console.log('\n⏱️ Cooling down for 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = Date.now() - startTime;

  // Print aggregate results
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 AGGREGATE RESULTS - ALL 20 RUNS');
  console.log(`${'═'.repeat(60)}\n`);

  const testNames = new Set<string>();
  allResults.forEach(run => {
    run.testResults.forEach((result: any) => testNames.add(result.testName));
  });

  const aggregateStats: Record<string, { passed: number; failed: number; avgDuration: number; errors: number }> = {};

  testNames.forEach(testName => {
    const runs = allResults.map(r => r.testResults.find((t: any) => t.testName === testName));
    const passed = runs.filter(r => r?.passed).length;
    const failed = runs.filter(r => !r?.passed).length;
    const avgDuration = runs.reduce((sum, r) => sum + (r?.duration || 0), 0) / runs.length;
    const errors = runs.reduce((sum, r) => sum + (r?.errors?.length || 0), 0);

    aggregateStats[testName] = { passed, failed, avgDuration, errors };
  });

  Object.entries(aggregateStats).forEach(([testName, stats]) => {
    const passRate = (stats.passed / 20 * 100).toFixed(2);
    const status = stats.passed === 20 ? '✅' : stats.failed > 15 ? '❌' : '⚠️';
    console.log(`${status} ${testName}`);
    console.log(`   Pass Rate: ${passRate}% (${stats.passed}/20)`);
    console.log(`   Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
    if (stats.errors > 0) console.log(`   Total Errors: ${stats.errors}`);
  });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Total Execution Time: ${(totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Average Per Run: ${(totalDuration / runCount / 1000).toFixed(2)} seconds`);

  // Save results to file
  const resultsFile = path.join(process.cwd(), 'stress-test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    summary: {
      totalRuns: runCount,
      totalDuration,
      aggregateStats
    },
    detailedResults: allResults
  }, null, 2));

  console.log(`\n📁 Results saved to: ${resultsFile}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Exit with success if all tests passed
  const allPassed = Object.values(aggregateStats).every(s => s.passed === 20);
  process.exit(allPassed ? 0 : 1);
}

runStressTests().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
