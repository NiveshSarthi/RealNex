const { pool } = require('./config/database');
const { redisClient } = require('./config/redis');
const axios = require('axios');

async function checkHealth() {
    console.log('--- Starting System Health Check ---');
    let hasErrors = false;

    // 1. Database Check
    try {
        const start = Date.now();
        const res = await pool.query('SELECT NOW() as time, current_database() as db_name');
        const duration = Date.now() - start;
        console.log(`[PASS] Database Connected: ${res.rows[0].db_name} (${duration}ms)`);
    } catch (error) {
        console.error(`[FAIL] Database Connection: ${error.message}`);
        hasErrors = true;
    }

    // 2. Redis Check
    try {
        if (redisClient && redisClient.isOpen) {
            const start = Date.now();
            await redisClient.ping();
            const duration = Date.now() - start;
            console.log(`[PASS] Redis Connected (${duration}ms)`);
        } else {
            console.log('[WARN] Redis client not initialized or open (skipped)');
        }
    } catch (error) {
        console.error(`[FAIL] Redis Connection: ${error.message}`);
        // Redis might be optional depending on config
    }

    // 3. Backend API Ping (Self)
    try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const start = Date.now();
        const res = await axios.get(`${backendUrl}/health`);
        const duration = Date.now() - start;
        if (res.status === 200) {
            console.log(`[PASS] Backend API Reachable (${duration}ms)`);
        } else {
            console.error(`[FAIL] Backend API returned status ${res.status}`);
            hasErrors = true;
        }
    } catch (error) {
        console.error(`[FAIL] Backend API Unreachable: ${error.message}`);
        hasErrors = true;
    }

    if (hasErrors) {
        console.log('--- Health Check Completed with ERRORS ---');
        process.exit(1);
    } else {
        console.log('--- Health Check Completed SUCCESSFULLY ---');
        process.exit(0);
    }
}

checkHealth();
